import pandas as pd
def detect_and_cast_numeric(df):
    """
    Detect columns that are truly numeric (not phone numbers, not IDs with text)
    and convert them safely to int or float.
    """
    numeric_cols = []
    for col in df.columns:
        col_values = df[col].dropna().astype(str)
        if col_values.empty:
            continue

        # Skip columns with '@', alphabetic chars, or long 10+ digit numbers (phones)
        if col_values.str.contains(r"[A-Za-z@]", regex=True).any():
            continue

        # Check if at least 95% of values look numeric (integers or floats)
        numeric_like_ratio = col_values.str.match(r"^-?\d+(\.\d+)?$").mean()
        if numeric_like_ratio > 0.95:
            # Further safeguard: skip 10+ digit numbers (likely contact numbers)
            if col_values.str.len().mean() >= 10:
                continue

            try:
                # Convert safely
                df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
                numeric_cols.append(col)
            except Exception as e:
                print(f"[NumericCast] Skipped {col}: {e}")

    print(f"[NumericCast] Converted numeric columns: {numeric_cols}")
    return df

# df = detect_and_cast_numeric(df)
