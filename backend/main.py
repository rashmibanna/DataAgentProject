import os
import io
import json
import pathlib
import pandas as pd
import requests
from datetime import datetime
from fastapi import FastAPI, Request, Query, Form, UploadFile, File, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from googleapiclient.errors import HttpError
from dotenv import load_dotenv
import logging

# ✅ Custom Imports (Refactored)
from utilities import detect_and_cast_numeric
from mapping_services import mapping_router
from store import USER_STORE 

# ✅ New Imports from extracted files
from auth_services import save_credentials, get_drive_service, make_session_token, CLIENT_ID, CLIENT_SECRET, SCOPES
from validation_logic import apply_validation_rules, call_gemini_generate_rules

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="AI Data Validation Tool")

# ✅ Include mapping service routes
app.include_router(mapping_router, prefix="/api/mapping")

# ✅ Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIRECT_URI = os.getenv("REDIRECT_URI", "http://127.0.0.1:8000/oauth2callback")
FRONTEND_URL = "http://localhost:3000"

if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("CLIENT_ID and CLIENT_SECRET must be set in .env")

# Directories
BASE_DIR = pathlib.Path(__file__).parent
TOKENS_DIR = BASE_DIR / "tokens"
TOKENS_DIR.mkdir(exist_ok=True)

# ----------------------------
# OAuth Routes
# ----------------------------
@app.get("/login")
def login():
    """Redirect to Google OAuth"""
    from google_auth_oauthlib.flow import Flow
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = REDIRECT_URI
    
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    return RedirectResponse(authorization_url)

@app.get("/oauth2callback")
async def oauth2callback(request: Request):
    """Handle OAuth callback and save user credentials"""
    code = request.query_params.get("code")
    error = request.query_params.get("error")
    
    if error:
        logger.error(f"❌ OAuth error: {error}")
        return RedirectResponse(f"{FRONTEND_URL}/?error={error}")
    
    try:
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code"
        }
        
        r = requests.post(token_url, data=data)
        r.raise_for_status()
        tokens = r.json()
        
        # Get user info
        access_token = tokens.get("access_token")
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        resp.raise_for_status()
        profile = resp.json()
        email = profile.get("email")
        
        save_credentials(email, tokens)
        
        return RedirectResponse(
            f"{FRONTEND_URL}/?email={email}&token={access_token}&status=success"
        )
    except Exception as e:
        logger.exception(f"❌ OAuth callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/?error=oauth_failed")

# ----------------------------
# Google Drive API Routes
# ----------------------------
@app.get("/api/drive/search")
def search_drive(email: str = Query(...), q: str = Query("")):
    """Search Google Drive for files"""
    try:
        service = get_drive_service(email)
        query = f"name contains '{q}' and mimeType != 'application/vnd.google-apps.folder' and trashed=false"
        
        response = service.files().list(
            q=query, spaces="drive", fields="files(id, name, mimeType, modifiedTime)", pageSize=20
        ).execute()

        files = response.get("files", [])
        return {"files": files}
    except Exception as e:
        return JSONResponse({"error": str(e), "files": []}, status_code=500)

@app.get("/api/drive/getfile")
def get_drive_file(email: str = Query(...), file_id: str = Query(...)):
    """Download file from Google Drive"""
    try:
        service = get_drive_service(email)
        
        try:
            file = service.files().get(fileId=file_id, fields="id, name, mimeType").execute()
        except HttpError as e:
            if e.resp.status == 404:
                return JSONResponse({"error": "File not found"}, status_code=404)
            raise
        
        filename = file["name"]
        mime_type = file["mimeType"]
        buffer = io.BytesIO()

        if mime_type.startswith("application/vnd.google-apps.spreadsheet"):
            request_data = service.files().export_media(fileId=file_id, mimeType="text/csv")
            if not filename.endswith('.csv'):
                filename = filename.rsplit('.', 1)[0] + '.csv'
        elif mime_type.startswith("application/vnd.google-apps"):
             return JSONResponse({"error": "Unsupported G-Suite file"}, status_code=400)
        else:
            request_data = service.files().get_media(fileId=file_id)

        downloader = MediaIoBaseDownload(buffer, request_data)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        buffer.seek(0)
        
        try:
            if filename.lower().endswith('.csv') or mime_type == 'text/csv':
                df = pd.read_csv(buffer, dtype=str)
            else:
                df = pd.read_excel(buffer)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

        df = detect_and_cast_numeric(df)
        USER_STORE.setdefault(email, {})
        USER_STORE[email]["dataframe"] = df
        USER_STORE[email]["filename"] = filename
        session_token = make_session_token(email, filename)
        USER_STORE[email]["last_session_token"] = session_token
        
        file_size = buffer.getbuffer().nbytes
        preview = df.head(5).replace({float("inf"): None, float("-inf"): None}).fillna("").to_dict(orient="records")

        return {
            "name": filename,
            "local_path": session_token,
            "preview": preview,
            "columns": list(df.columns),
            "size_kb": round(file_size / 1024, 2),
            "mime_type": mime_type
        }

    except Exception as e:
        logger.error(f"Drive download error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# ----------------------------
# File Upload Route
# ----------------------------
@app.post("/api/upload_local")
async def api_upload_local(email: str = Form(...), file: UploadFile = File(...)):
    if email not in USER_STORE:
        USER_STORE.setdefault(email, {})
    contents = await file.read()
    filename_lower = file.filename.lower() 

    try:
        if filename_lower.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine="python", dtype=str)
            except:
                df = pd.read_csv(io.BytesIO(contents), dtype=str)
        elif filename_lower.endswith(".json"):
             json_data = json.load(io.BytesIO(contents))
             if isinstance(json_data, dict):
                 df = pd.DataFrame([json_data])
             else:
                 df = pd.DataFrame(json_data)
        elif filename_lower.endswith((".xls", ".xlsx", ".xlsm")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
             raise Exception("Unsupported file format")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    df = detect_and_cast_numeric(df)
    USER_STORE[email]["dataframe"] = df
    USER_STORE[email]["filename"] = pathlib.Path(file.filename).name
    session_token = make_session_token(email, USER_STORE[email]["filename"])
    USER_STORE[email]["last_session_token"] = session_token

    preview = df.head(5).replace({float("inf"): None, float("-inf"): None}).fillna("").to_dict(orient="records")
    return {"name": USER_STORE[email]["filename"], "preview": preview, "local_path": session_token}

# ----------------------------
# Validation Rules API
# ----------------------------
@app.post("/api/get_validation_rules")
async def api_get_validation_rules(email: str = Form(...)):
    if email not in USER_STORE or "dataframe" not in USER_STORE[email]:
        raise HTTPException(status_code=404, detail="No dataset loaded.")

    df = USER_STORE[email]["dataframe"]
    df = detect_and_cast_numeric(df)
    headers = list(df.columns)
    sample_rows = df.head(3).to_dict(orient="records")

    rules = call_gemini_generate_rules(headers, sample_rows)
    
    # Ensure consistent return format
    if isinstance(rules, dict):
        flattened = []
        for col, lst in rules.items():
            for rule in lst:
                flattened.append({
                    "column": col,
                    "rule": rule.get("rule_id") or rule.get("rule"),
                    "description": rule.get("description", "")
                })
        rules = flattened

    return {"rules": rules, "headers": headers}

@app.post("/api/regenerate_rules")
async def api_regenerate_rules(
    email: str = Form(...),
    edits_json: str = Form(...),
    current_headers_json: str = Form(None)
):
    if email not in USER_STORE or "dataframe" not in USER_STORE[email]:
         raise HTTPException(status_code=404, detail="No dataset loaded.")

    df = USER_STORE[email]["dataframe"]
    try:
        user_edits = json.loads(edits_json)
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    active_headers = list(df.columns)
    if current_headers_json:
        try:
            client_headers = json.loads(current_headers_json)
            active_headers = [h for h in active_headers if h in client_headers]
        except:
            pass

    df_filtered = df[active_headers]
    sample_rows = df_filtered.head(5).to_dict(orient="records")
    new_rules = call_gemini_generate_rules(active_headers, sample_rows, user_guidance=user_edits)

    # Flatten logic (abbreviated for brevity, same as above)
    if isinstance(new_rules, dict):
        flattened = []
        for col, lst in new_rules.items():
            for rule in lst:
                if col in active_headers: 
                    flattened.append({"column": col, "rule": rule.get("rule"), "description": rule.get("description", "")})
        new_rules = flattened

    return {"rules": new_rules, "headers": active_headers}

@app.post("/api/run_validation")
async def api_run_validation(
    email: str = Form(...),
    filename: str = Form(...),
    rules_json: str = Form(...),
):
    if email not in USER_STORE or "dataframe" not in USER_STORE[email]:
        raise HTTPException(status_code=400, detail="No dataset in memory.")

    df = USER_STORE[email]["dataframe"].copy()
    try:
        rules = json.loads(rules_json)
    except:
        raise HTTPException(status_code=400, detail="Invalid rules_json")

    good_df, bad_df = apply_validation_rules(df, rules)
    
    # ... (Excel generation logic remains similar) ...
    mem_file = io.BytesIO()
    with pd.ExcelWriter(mem_file, engine="openpyxl") as writer:
        good_df.to_excel(writer, "Good_Data", index=False)
        bad_df.to_excel(writer, "Bad_Data", index=False)
    mem_file.seek(0)

    try:
        service = get_drive_service(email)
        media = MediaIoBaseUpload(mem_file, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", resumable=False)
        metadata = {"name": f"validation_result_{filename}", "mimeType": "application/vnd.google-apps.spreadsheet"}
        
        created = service.files().create(body=metadata, media_body=media, fields="id,webViewLink").execute()
        
        # Set permissions
        try:
            service.permissions().create(fileId=created.get("id"), body={"type": "anyone", "role": "reader"}).execute()
        except: pass

        return {
            "workbook": {"id": created.get("id"), "webViewLink": created.get("webViewLink")},
            "good_count": len(good_df),
            "bad_count": len(bad_df),
        }
    except Exception as e:
        logger.error(f"Drive upload error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/")
def root():
    return {"message": "AI Data Validation Tool is running! ✅", "frontend": FRONTEND_URL}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)