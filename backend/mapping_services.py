# mapping_services.py — COMPLETE FILE
# Handles field mapping between source and target systems using LLM + hybrid approaches
# Supports Google Drive files, Local uploads, and In-Memory Sessions

import os
import io
import re
import json
import logging
import base64
from datetime import datetime
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Dict, List, Optional, Tuple
from functools import lru_cache
from dotenv import load_dotenv

# ✅ IMPORT SHARED STORE (Crucial for finding uploaded files)
from store import USER_STORE

import pandas as pd
from fastapi import APIRouter, HTTPException, Form
import google.generativeai as genai
from gdrive_services import (
    find_file_by_id, download_file_bytes,
    upload_to_gdrive
)

# Load environment variables from .env file
load_dotenv()

# ==================== CONFIGURATION ====================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mapping_router = APIRouter(tags=["Mapping"])

# Constants
DEFAULT_HOST_SYSTEM = "Host System"
DEFAULT_TARGET_SYSTEM = "Target System"
DEFAULT_LLM_TIMEOUT = 200.0  # Increased timeout for large files
DEFAULT_SIMILARITY_THRESHOLD = 0.4
SEMANTIC_WEIGHT = 0.65
STRING_WEIGHT = 0.35
MAX_EXECUTOR_WORKERS = 4

# Gemini Setup
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

if GEMINI_KEY:
    try:
        genai.configure(api_key=GEMINI_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        logger.info(f"✅ Gemini configured with model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        gemini_model = None
        logger.error(f"❌ Failed to configure Gemini: {e}")
else:
    gemini_model = None
    logger.warning("⚠️ GEMINI_API_KEY not set — LLM calls will use hybrid fallback")

# ==================== SYNONYM MAP ====================
SYNONYM_MAP = {
    "client": ["customer", "user", "account"],
    "customer": ["client", "user", "account"],
    "addr": ["address", "location", "street"],
    "invoice": ["billing", "bill"],
    "billing": ["invoice", "bill"],
    "ship": ["shipping", "delivery"],
    "phone": ["contact", "contact_no", "phone_number", "mobile", "telephone"],
    "dob": ["date_of_birth", "birth_date", "birthdate"],
    "salary": ["income", "annual_income", "yearly_salary", "compensation"],
    "reward": ["loyalty", "points", "reward_balance", "rewards"],
    "lang": ["language", "preferred_language", "lang_pref", "locale"],
    "joined": ["registration", "joined_on", "signup_date", "created_date"],
    "job": ["occupation", "job_title", "profession", "position"],
    "last_order": ["last_purchase", "last_order_date", "last_purchase_date"],
    "email": ["mail", "email_address", "e_mail"],
    "id": ["identifier", "unique_id", "code"],
    "status": ["state", "condition"],
    "qty": ["quantity", "amount", "count"],
    "desc": ["description", "details"],
}

# ==================== OPTIONAL ENHANCEMENTS ====================
# We wrap these in try-except to ensure the app runs even if libraries are missing
try:
    from sentence_transformers import SentenceTransformer, util as st_util
    ST_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("✅ Sentence Transformers loaded")
except Exception as e:
    ST_MODEL = None
    logger.warning(f"⚠️ sentence-transformers not available: {e}")

try:
    from rapidfuzz import fuzz
    logger.info("✅ RapidFuzz loaded")
except Exception:
    fuzz = None
    logger.warning("⚠️ rapidfuzz not available, using SequenceMatcher fallback")

# ==================== EXECUTOR FOR TIMEOUT ====================
_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_EXECUTOR_WORKERS)


# ==================== FILE & TOKEN UTILITIES (FIXED) ====================

def is_local_file(file_path: str) -> bool:
    """Check if the provided path is a local physical file"""
    if not file_path: return False
    try:
        return os.path.exists(file_path) and os.path.isfile(file_path)
    except Exception:
        return False

def is_session_token(token: str) -> bool:
    """
    ✅ Checks if the string is a base64 encoded session token.
    Logic: It must decode successfully and contain the '||' delimiter.
    """
    if not token or len(token) < 20: 
        return False
    try:
        decoded = base64.urlsafe_b64decode(token).decode("utf-8")
        return "||" in decoded
    except Exception:
        return False

def get_data_from_memory(token: str) -> Any:
    """
    ✅ Decodes token and retrieves DataFrame from the Shared USER_STORE.
    """
    try:
        decoded = base64.urlsafe_b64decode(token).decode("utf-8")
        parts = decoded.split("||")
        if len(parts) < 3:
            return None
            
        email, filename, timestamp = parts[0], parts[1], parts[2]
        
        logger.info(f"🔍 Looking up memory data for: {email} | File: {filename}")

        if email not in USER_STORE:
            logger.error(f"❌ User {email} not found in USER_STORE.")
            return None
            
        user_data = USER_STORE[email]
        
        if "dataframe" not in user_data:
            logger.error("❌ No dataframe found in user session.")
            return None

        df = user_data["dataframe"]
        # Convert to list of dicts for JSON processing
        return df.to_dict(orient="records")

    except Exception as e:
        logger.error(f"❌ Failed to retrieve data from token: {e}")
        return None


# ==================== SIMILARITY UTILITIES ====================
@lru_cache(maxsize=1000)
def get_synonyms(token: str) -> set:
    """Get all synonyms for a token (cached)"""
    synonyms = {token}
    for canonical, syns in SYNONYM_MAP.items():
        if token == canonical or token in syns:
            synonyms.update([canonical] + syns)
    return synonyms

def synonym_boost_score(src_tokens: List[str], tgt_tokens: List[str]) -> float:
    """Boost score if synonyms match"""
    boost = 0.0
    for s in src_tokens:
        src_syns = get_synonyms(s)
        for t in tgt_tokens:
            if t in src_syns:
                boost += 0.15
    return min(boost, 0.4)

@lru_cache(maxsize=10000)
def compute_string_similarity(a: str, b: str) -> float:
    """Compute string similarity using rapidfuzz or SequenceMatcher (cached)"""
    a_lower, b_lower = (a or "").lower(), (b or "").lower()
    if fuzz:
        try:
            return fuzz.token_set_ratio(a_lower, b_lower) / 100.0
        except Exception as e:
            logger.debug(f"Fuzz error: {e}")
    return SequenceMatcher(None, a_lower, b_lower).ratio()

def compute_semantic_similarity_batch(list_a: List[str], list_b: List[str]) -> Dict[Tuple[int, int], float]:
    """Compute semantic similarity between two lists of strings"""
    if ST_MODEL is None:
        return {
            (i, j): compute_string_similarity(a, b)
            for i, a in enumerate(list_a)
            for j, b in enumerate(list_b)
        }
    
    try:
        emb_a = ST_MODEL.encode(list_a, convert_to_tensor=True, show_progress_bar=False)
        emb_b = ST_MODEL.encode(list_b, convert_to_tensor=True, show_progress_bar=False)
        cos = st_util.cos_sim(emb_a, emb_b)
        return {(i, j): float(cos[i][j]) for i in range(len(list_a)) for j in range(len(list_b))}
    except Exception as e:
        logger.error(f"Semantic similarity error: {e}")
        return {
            (i, j): compute_string_similarity(a, b)
            for i, a in enumerate(list_a)
            for j, b in enumerate(list_b)
        }


# ==================== JSON UTILITIES ====================
def safe_json_parse(text: str) -> Any:
    """Safely parse JSON with multiple fallback strategies"""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    patterns = [
        r"```json\s*([\s\S]*?)\s*```",
        r"(\{[\s\S]*\}|\[[\s\S]*\])",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
    
    raise json.JSONDecodeError(f"Could not parse JSON from text", text, 0)

def extract_json_content_from_file_local(file_path: str) -> Any:
    """Read and parse JSON from local file"""
    try:
        logger.info(f"Reading local file: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        return safe_json_parse(text)
    except Exception as e:
        logger.error(f"⚠️ Error reading local file {file_path}: {e}")
        raise

def extract_json_content_from_file(file_id: str, email: str) -> Any:
    """Download and parse JSON from Google Drive file"""
    try:
        logger.info(f"Downloading from Google Drive: {file_id}")
        data = download_file_bytes(file_id ,email)
        text = data.decode("utf-8", errors="ignore")
        return safe_json_parse(text)
    except Exception as e:
        logger.error(f"⚠️ Error extracting JSON from Drive: {e}")
        raise

def extract_all_leaf_paths_from_json(obj: Any, prefix: str = "", max_depth: int = 10) -> List[str]:
    """Extract all leaf JSON paths from nested object"""
    if max_depth <= 0:
        return [prefix] if prefix else []
    
    out = []

    if isinstance(obj, dict):
        if not obj:
            out.append(prefix)
        for k, v in obj.items():
            full = f"{prefix}.{k}" if prefix else k
            out.extend(extract_all_leaf_paths_from_json(v, full, max_depth - 1))
    elif isinstance(obj, list):
        if not obj:
            out.append(prefix)
        elif isinstance(obj[0], (dict, list)):
            # Analyze only the first item of a list to deduce schema
            out.extend(extract_all_leaf_paths_from_json(obj[0], prefix, max_depth - 1))
        else:
            out.append(prefix)
    else:
        out.append(prefix)
    
    return out


# ==================== HYBRID FALLBACK MAPPER ====================
def tokenize_field(field: str) -> List[str]:
    """Tokenize field name for comparison"""
    return re.findall(r"[A-Za-z0-9]+", field.lower())


def hybrid_smart_map(
    fields_src: List[str],
    fields_tgt: List[str],
    sem_weight: float = SEMANTIC_WEIGHT,
    str_weight: float = STRING_WEIGHT,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD
) -> List[Dict[str, Any]]:
    """Hybrid mapping using semantic + string similarity + synonym boosting"""
    if not fields_src:
        logger.warning("No source fields provided")
        return []
    
    if not fields_tgt:
        logger.warning("No target fields provided")
        return [{"source_field": s, "target_field": "N/A", "score": 0.0} for s in fields_src]

    sem_scores = compute_semantic_similarity_batch(fields_src, fields_tgt)
    tokenized_src = [tokenize_field(s) for s in fields_src]
    tokenized_tgt = [tokenize_field(t) for t in fields_tgt]
    
    mappings = []
    for i, s in enumerate(fields_src):
        best_score, best_tgt = 0.0, None
        
        for j, t in enumerate(fields_tgt):
            sem = sem_scores.get((i, j), 0)
            strsim = compute_string_similarity(s, t)
            syn_boost = synonym_boost_score(tokenized_src[i], tokenized_tgt[j])
            score = sem_weight * sem + str_weight * strsim + syn_boost
            
            if score > best_score:
                best_score, best_tgt = score, t
        
        mappings.append({
            "source_field": s,
            "target_field": best_tgt if best_score >= threshold else "N/A",
            "score": round(best_score, 4)
        })
    
    logger.info(f"Hybrid mapping completed: {len(mappings)} mappings generated")
    return mappings


# ==================== LLM UTILITIES ====================
def build_mapping_prompt(host_fields: Any, target_fields: Any, host_system: str, target_system: str) -> str:
    """Build the enhanced LLM prompt for field mapping"""
    
    # Truncate if too large to prevent token limits
    host_preview = host_fields[:10] if isinstance(host_fields, list) else host_fields
    target_preview = target_fields[:10] if isinstance(target_fields, list) else target_fields

    src_str = json.dumps(host_preview, indent=2, ensure_ascii=False)
    tgt_str = json.dumps(target_preview, indent=2, ensure_ascii=False)

    return f"""You are an expert **Data Integration and Schema Mapping Architect**.
    
    Context:
    Host System: {host_system}
    Target System: {target_system}

    Host Data Sample:
    {src_str}

    Target Data Sample:
    {tgt_str}

    Objective:
    Map every field from the Host system to the Target system.
    
    Output Format:
    Return ONLY a JSON Array.
    [
      {{
        "Source Field (JSON Path)": "Field_Name",
        "Source System": "{host_system}",
        "Source Data Type": "string",
        "Sample Source Value": "Example",
        "Transformation / Logic": "Direct Mapping",
        "Target Field (API Name)": "Mapped_Field_Name",
        "Target System": "{target_system}",
        "Target Data Type": "string",
        "Sample Target Value": "Example",
        "Comments / Notes": "Reasoning"
      }}
    ]
    """


def _run_gemini_sync(prompt: str) -> str:
    """Call Gemini synchronously"""
    if gemini_model is None:
        raise RuntimeError("No Gemini model configured")
    
    resp = gemini_model.generate_content([prompt])
    
    if hasattr(resp, "text") and resp.text:
        return resp.text
    if hasattr(resp, "candidates") and resp.candidates:
        try:
            parts = resp.candidates[0].content.parts
            if parts and hasattr(parts[0], "text"):
                return parts[0].text
        except (IndexError, AttributeError) as e:
            logger.error(f"Error extracting text from response: {e}")
    
    raise ValueError("Empty or invalid response from Gemini")


def run_gemini_with_timeout(prompt: str, timeout_seconds: float = DEFAULT_LLM_TIMEOUT) -> str:
    """Run Gemini with timeout"""
    if gemini_model is None:
        raise RuntimeError("Gemini not configured")
    
    future = _EXECUTOR.submit(_run_gemini_sync, prompt)
    try:
        return future.result(timeout=timeout_seconds)
    except FutureTimeout:
        future.cancel()
        raise TimeoutError(f"LLM request timed out after {timeout_seconds}s")


def normalize_llm_mapping_response(parsed: Any, host_system: str, target_system: str) -> List[Dict[str, Any]]:
    """Normalize LLM response to standard format"""
    if isinstance(parsed, dict) and "mapping" in parsed:
        parsed = parsed["mapping"]
    
    if not isinstance(parsed, list):
        # Sometimes LLM wraps it in a top level key, try to find a list
        if isinstance(parsed, dict):
             for k,v in parsed.items():
                 if isinstance(v, list):
                     parsed = v
                     break
        if not isinstance(parsed, list):
             raise ValueError("LLM returned non-list structure")

    normalized = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        
        # Handle multiple possible field names (LLMs can be inconsistent)
        src_path = (item.get("Source Field (JSON Path)") or item.get("source") or item.get("Source") or "")
        src_data_type = item.get("Source Data Type", "")
        src_sample = item.get("Sample Source Value", "")
        transformation = item.get("Transformation / Logic", item.get("transformation", "Direct Mapping"))
        tgt_field = (item.get("Target Field (API Name)") or item.get("Target Field") or item.get("target") or "N/A")
        tgt_data_type = item.get("Target Data Type", "")
        tgt_sample = item.get("Sample Target Value", "")
        comments = item.get("Comments / Notes", item.get("Comments", ""))

        normalized.append({
            "source": src_path,
            "target": tgt_field or "N/A",
            "details": {
                "source_system": host_system,
                "target_system": target_system,
                "transformation": transformation,
                "notes": comments,
                "source_data_type": src_data_type,
                "source_sample": src_sample,
                "target_data_type": tgt_data_type,
                "target_sample": tgt_sample,
            }
        })

    return normalized


def llm_field_mapping(
    host_fields: Any,
    target_fields: Any,
    host_system: str,
    target_system: str,
    llm_timeout: float = DEFAULT_LLM_TIMEOUT
) -> List[Dict[str, Any]]:
    """Try LLM first, fallback to hybrid if it fails"""
    if gemini_model is None:
        logger.warning("⚠️ LLM not configured — using hybrid fallback")
        return _fallback_to_hybrid(host_fields, target_fields)

    prompt = build_mapping_prompt(host_fields, target_fields, host_system, target_system)

    try:
        text = run_gemini_with_timeout(prompt, timeout_seconds=llm_timeout)
        
        if not text:
            raise ValueError("Empty response from Gemini")
        
        # Remove markdown code blocks
        text = text.replace("```json", "").replace("```", "").strip()
        
        # Find JSON array
        match = re.search(r"(\[[\s\S]*\])", text)
        if not match:
            # Fallback: try to find just a JSON object
            match = re.search(r"(\{[\s\S]*\})", text)
            if not match:
                 raise ValueError(f"No JSON found in Gemini response")

        parsed = json.loads(match.group(0))
        normalized = normalize_llm_mapping_response(parsed, host_system, target_system)
        
        if not normalized:
            raise ValueError("Gemini returned empty mapping")

        logger.info(f"✅ LLM mapping completed: {len(normalized)} mappings")
        return normalized

    except Exception as e:
        logger.warning(f"⚠️ LLM failed ({e.__class__.__name__}: {e}), falling back to hybrid")
        return _fallback_to_hybrid(host_fields, target_fields)


def _fallback_to_hybrid(host_fields: Any, target_fields: Any) -> List[Dict[str, Any]]:
    """Fallback to hybrid mapping"""
    host_paths = extract_all_leaf_paths_from_json(host_fields) if isinstance(host_fields, (dict, list)) else [str(host_fields)]
    target_paths = extract_all_leaf_paths_from_json(target_fields) if isinstance(target_fields, (dict, list)) else [str(target_fields)]
    
    hybrid = hybrid_smart_map(host_paths, target_paths)
    
    return [
        {
            "source": m["source_field"],
            "target": m["target_field"],
            "details": {"score": m["score"], "method": "hybrid"}
        }
        for m in hybrid
    ]


# ==================== API ENDPOINTS (FIXED LOGIC) ====================

@mapping_router.post("/smart_mapping_with_files")
async def smart_mapping_with_files(
    email: str = Form(...),
    host_file_id: str = Form(...),
    target_file_id: str = Form(...),
    host_system: str = Form(DEFAULT_HOST_SYSTEM),
    target_system: str = Form(DEFAULT_TARGET_SYSTEM)
):
    """
    Smart mapping with files from Google Drive OR In-Memory Session OR Local Path
    """
    try:
        logger.info(f"📥 Starting mapping for user: {email}")
        logger.info(f"📥 Inputs: Host={host_file_id}, Target={target_file_id}")
        
        # ==================== HANDLE HOST FILE ====================
        # 1. Check if it's an In-Memory Token
        if is_session_token(host_file_id):
            logger.info("✅ Host file: IN-MEMORY SESSION")
            host_fields = get_data_from_memory(host_file_id)
            if host_fields is None:
                 raise HTTPException(status_code=404, detail="Host file session expired or not found. Please re-upload.")
            
            # Extract filename from token
            try:
                decoded = base64.urlsafe_b64decode(host_file_id).decode("utf-8")
                fname = decoded.split("||")[1]
            except:
                fname = "host_upload.json"
            host_file = {"id": "local", "name": fname}
            
        # 2. Check if it's a physical local file (Legacy/Dev usage)
        elif is_local_file(host_file_id):
            logger.info("✅ Host file: LOCAL DISK")
            with open(host_file_id, 'r') as f:
                host_fields = json.load(f)
            host_file = {"id": host_file_id, "name": os.path.basename(host_file_id)}
            
        # 3. Assume Google Drive
        else:
            logger.info("✅ Host file: GOOGLE DRIVE")
            host_file = find_file_by_id(host_file_id, email)
            if not host_file:
                raise HTTPException(status_code=404, detail=f"Host file not found in Drive: {host_file_id}")
            host_fields = extract_json_content_from_file(host_file_id, email)

        # ==================== HANDLE TARGET FILE ====================
        # 1. Check if it's an In-Memory Token
        if is_session_token(target_file_id):
            logger.info("✅ Target file: IN-MEMORY SESSION")
            target_fields = get_data_from_memory(target_file_id)
            if target_fields is None:
                 raise HTTPException(status_code=404, detail="Target file session expired. Please re-upload.")
            
            try:
                decoded = base64.urlsafe_b64decode(target_file_id).decode("utf-8")
                fname = decoded.split("||")[1]
            except:
                fname = "target_upload.json"
            target_file = {"id": "local", "name": fname}

        # 2. Physical Local File
        elif is_local_file(target_file_id):
            logger.info("✅ Target file: LOCAL DISK")
            with open(target_file_id, 'r') as f:
                target_fields = json.load(f)
            target_file = {"id": target_file_id, "name": os.path.basename(target_file_id)}
            
        # 3. Google Drive
        else:
            logger.info("✅ Target file: GOOGLE DRIVE")
            target_file = find_file_by_id(target_file_id, email)
            if not target_file:
                raise HTTPException(status_code=404, detail=f"Target file not found in Drive: {target_file_id}")
            target_fields = extract_json_content_from_file(target_file_id, email)

        logger.info(f"📄 Processing: {host_file['name']} -> {target_file['name']}")

        # ==================== PERFORM MAPPING ====================
        mapping = llm_field_mapping(host_fields, target_fields, host_system, target_system, llm_timeout=200.0)

        # ==================== UPLOAD RESULT ====================
        parent_id = None
        if "parents" in host_file and host_file["parents"]:
             parent_id = host_file["parents"][0]
        
        host_base_name = os.path.splitext(host_file['name'])[0]
        target_base_name = os.path.splitext(target_file['name'])[0]

        upload_resp = upload_to_gdrive(
            mapping, 
            host_file, 
            target_file, 
            None, 
            parent_id, 
            host_base_name,
            target_base_name,
            email 
        )

        logger.info(f"✅ Mapping complete. Upload Response keys: {upload_resp.keys() if upload_resp else 'None'}")

        # ✅ FIX: Handle the URL return properly (webViewLink vs file_url)
        final_url = upload_resp.get("webViewLink") or upload_resp.get("file_url") or upload_resp.get("alternateLink")

        return {
            "status": "success",
            "mapping_count": len(mapping),
            "mapping": mapping,
            "host_file": {"id": host_file.get("id"), "name": host_file.get("name")},
            "target_file": {"id": target_file.get("id"), "name": target_file.get("name")},
            "file_url": final_url,
            "preview": json.dumps(mapping[:10], indent=2, ensure_ascii=False)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [Mapping Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@mapping_router.get("/test_mapping")
async def test_mapping():
    """Test endpoint to verify mapping service is working"""
    return {
        "status": "Mapping service is running",
        "timestamp": datetime.now().isoformat(),
        "configuration": {
            "llm_configured": gemini_model is not None,
            "llm_model": GEMINI_MODEL_NAME if gemini_model else None,
            "semantic_model": ST_MODEL is not None,
            "fuzzy_matching": fuzz is not None,
        }
    }


@mapping_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "mapping_service",
        "timestamp": datetime.now().isoformat()
    }