import os
import json
import base64
import secrets
from datetime import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

# Constants needed for Auth
CLIENT_ID = os.getenv("CLIENT_NEW_ID")
CLIENT_SECRET = os.getenv("CLIENT_NEW_SECRET")
SCOPES = [
    "openid", "email", "profile",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.metadata.readonly"
]

def save_credentials(email, tokens):
    """Save user credentials to file"""
    os.makedirs("tokens", exist_ok=True)
    creds_data = {
        "token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", ""),
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scopes": SCOPES
    }
    with open(f"tokens/{email}.json", "w") as f:
        json.dump(creds_data, f)

def load_credentials(email):
    """Load user credentials from file"""
    path = f"tokens/{email}.json"
    if not os.path.exists(path):
        raise Exception("No saved Google credentials")
    return Credentials.from_authorized_user_file(path, SCOPES)

def get_drive_service(email: str):
    """Get Google Drive service for user"""
    try:
        creds = load_credentials(email)
        return build("drive", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"User not authenticated: {e}")

def make_session_token(email: str, filename: str) -> str:
    """Create a short session token used for local path references"""
    raw = f"{email}||{filename}||{datetime.utcnow().isoformat()}"
    token = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")
    return token