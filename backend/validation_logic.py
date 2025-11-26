import os
import re
import json
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def _normalize_value_for_rule(value):
    """Normalize value for rule evaluation"""
    if pd.isna(value):
        return None
    if isinstance(value, str):
        v = value.strip()
        if re.fullmatch(r"[+-]?\d+", v):
            try:
                return int(v)
            except Exception:
                pass
        if re.fullmatch(r"[+-]?\d+\.\d+", v):
            try:
                return float(v)
            except Exception:
                pass
        return v
    return value

def apply_validation_rules(df: pd.DataFrame, rules):
    """Apply validation rules to dataframe and separate good/bad data"""
    work = df.copy()
    work["_validation_status"] = "Good"
    work["_validation_reason"] = ""

    for idx, row in work.iterrows():
        errors = []
        for rule in rules:
            col = rule.get("column")
            expr = rule.get("rule")
            desc = rule.get("description", "Rule failed")

            if not col or col not in df.columns or not expr:
                continue

            value = _normalize_value_for_rule(row[col])

            # Handle required fields
            if (value is None or str(value).strip() == "") and any(
                kw in desc.lower() for kw in ["required", "not empty", "non-empty"]
            ):
                errors.append(f"{col}: {desc}")
                continue

            try:
                # Safe eval with limited builtins
                safe_env = {
                    "value": value,
                    "re": re,
                    "isinstance": isinstance,
                    "int": int,
                    "float": float,
                    "str": str,
                    "len": len,
                    "bool": bool,
                    "any": any,
                    "all": all,
                }
                ok = bool(eval(expr, {"__builtins__": None}, safe_env))
                if not ok:
                    errors.append(f"{col}: {desc}")
            except Exception as e:
                print(f"[Eval Error] {col} -> {e} | Expr: {expr}")
                errors.append(f"{col}: Rule eval error")

        if errors:
            work.at[idx, "_validation_status"] = "Bad"
            work.at[idx, "_validation_reason"] = "; ".join(errors)

    good = work[work["_validation_status"] == "Good"].drop(columns=["_validation_status", "_validation_reason"])
    bad = work[work["_validation_status"] == "Bad"].drop(columns=["_validation_status"])
    return good, bad

def call_gemini_generate_rules(headers, sample_rows, user_guidance=None, previous_rules=None):
    """Generate or refine validation rules using Gemini SDK"""
    if not GEMINI_API_KEY:
        return {h: [{"rule_id": "required", "type": "required", "description": "Must not be empty"}] for h in headers}

    prompt = f"""
    You are an expert Data Quality Validator.
    Given column names (and optionally sample data), generate Python boolean expressions for validating correct values.
    
    🔹 Each rule must be directly executable in Python with the variable name `value`.
    🔹 Be data-type aware:
       - For numeric columns (IDs, counts, income, loyalty points): use integer checks.
       - For dates: use regex r'^\\d{{2}}-\\d{{2}}-\\d{{4}}$'.
       - For emails: '@' in value and '.' in value.
       - For text columns: isinstance(value, str) and len(value.strip()) > 0.
    
    🔹 Output **only** a valid JSON array — no extra text.
    
    Columns:
    {', '.join(headers)}
    Sample rows:
    {json.dumps(sample_rows[:5], indent=2, default=str)}
    """

    if previous_rules and user_guidance:
        prompt += f"\nPrevious rules:\n{json.dumps(previous_rules, indent=2, default=str)}\nUser provided these edits:\n{json.dumps(user_guidance, indent=2, default=str)}\nPlease refine."
    elif user_guidance:
        prompt += f"\nUser edits:\n{json.dumps(user_guidance, indent=2, default=str)}"

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Extract JSON content
        match = re.search(r"\[[\s\S]*\]", text)
        if not match:
            print("[Gemini SDK] No valid JSON detected")
            return {h: [{"rule_id": "required", "type": "required", "description": "Must not be empty"}] for h in headers}

        raw_json = match.group(0).strip()
        raw_json = raw_json.strip("```json").strip("```").strip()
        
        try:
            rules = json.loads(raw_json)
        except json.JSONDecodeError:
            closing_index = raw_json.find("]") + 1
            rules = json.loads(raw_json[:closing_index])
        
        return rules
        
    except Exception as e:
        print("[Gemini SDK Error]", e)
        return {h: [{"rule_id": "required", "type": "required", "description": "Must not be empty"}] for h in headers}