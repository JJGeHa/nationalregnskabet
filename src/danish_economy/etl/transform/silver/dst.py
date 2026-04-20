"""Silver transform for DST StatBank tables.

Reads the latest bronze run for a given table, cleans column names to English,
parses DST date formats, and writes a typed Parquet file.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[5] / "data"

# DST column name → English name mappings (extendable per table).
# Keys are lowercased DST variable IDs.
COLUMN_NAMES: dict[str, str] = {
    "tid": "date",
    "sektor": "sector",
    "ui": "category",
    "indhold": "value",
    "område": "area",
    "herkomst": "origin",
    "alder": "age",
    "køn": "sex",
}


def find_latest_bronze_run(table_id: str, data_dir: Path | None = None) -> Path:
    """Find the most recent bronze run directory for a DST table."""
    base = data_dir or DATA_DIR
    table_dir = base / "bronze" / "dst" / table_id
    if not table_dir.exists():
        raise FileNotFoundError(f"No bronze data for table {table_id} at {table_dir}")

    run_dirs = sorted(table_dir.glob("run_date=*"))
    if not run_dirs:
        raise FileNotFoundError(f"No runs found in {table_dir}")
    return run_dirs[-1]


def parse_dst_date(date_str: str) -> date:
    """Parse DST date formats into Python date objects.

    Supported formats:
      - "2024"     → 2024-01-01 (yearly)
      - "2024K1"   → 2024-01-01 (quarterly: K1=Jan, K2=Apr, K3=Jul, K4=Oct)
      - "2024K01"  → 2024-01-01 (quarterly with leading zero)
      - "2024M03"  → 2024-03-01 (monthly)
      - "2024M3"   → 2024-03-01 (monthly without leading zero)
    """
    s = date_str.strip()

    # Yearly: "2024"
    if s.isdigit() and len(s) == 4:
        return date(int(s), 1, 1)

    # Quarterly: "2024K1" or "2024K01"
    if "K" in s:
        parts = s.split("K")
        year = int(parts[0])
        quarter = int(parts[1])
        month = (quarter - 1) * 3 + 1
        return date(year, month, 1)

    # Monthly: "2024M03" or "2024M3"
    if "M" in s:
        parts = s.split("M")
        year = int(parts[0])
        month = int(parts[1])
        return date(year, month, 1)

    raise ValueError(f"Unrecognised DST date format: {date_str!r}")


def transform_table(
    table_id: str,
    *,
    data_dir: Path | None = None,
) -> Path:
    """Transform the latest bronze run for a DST table into silver Parquet.

    Returns the path to the written silver Parquet file.
    """
    base = data_dir or DATA_DIR
    run_dir = find_latest_bronze_run(table_id, base)

    # Read metadata to get variable info for column mapping
    meta_path = run_dir / "metadata.json"
    with open(meta_path) as f:
        metadata = json.load(f)

    # Build column rename map from metadata
    rename_map = _build_rename_map(metadata)

    # Read raw BULK CSV (semicolon-separated).
    # Read everything as String first to preserve dimension codes like "1" vs "1.0".
    raw_path = run_dir / "raw.csv"
    df = pl.read_csv(
        raw_path,
        separator=";",
        infer_schema_length=0,
        encoding="utf8-lossy",
    )

    # Rename columns to English
    for old_name in df.columns:
        new_name = rename_map.get(old_name.lower(), old_name.lower())
        if old_name != new_name:
            df = df.rename({old_name: new_name})

    # Parse date column
    if "date" in df.columns:
        df = df.with_columns(
            pl.col("date")
            .map_elements(lambda x: parse_dst_date(str(x)), return_dtype=pl.Date)
            .alias("date")
        )

    # Clean value column: DST uses ".." for missing, and may have space separators
    if "value" in df.columns:
        df = df.with_columns(
            pl.col("value")
            .cast(pl.String)
            .str.replace_all(" ", "")
            .str.replace_all(",", ".")
            .replace({".": None, "..": None})
            .cast(pl.Float64, strict=False)
            .alias("value")
        )

    # Drop exact duplicate rows
    df = df.unique()

    # Write silver Parquet
    silver_dir = base / "silver" / "dst"
    silver_dir.mkdir(parents=True, exist_ok=True)
    output_path = silver_dir / f"{table_id.lower()}.parquet"
    df.write_parquet(output_path)
    print(f"Silver: {output_path} — {df.shape[0]} rows, {df.shape[1]} columns")
    return output_path


def _build_rename_map(metadata: dict[str, Any]) -> dict[str, str]:
    """Build a lowercase column name → English name mapping from DST metadata."""
    rename: dict[str, str] = {}
    for var in metadata.get("variables", []):
        var_id = var["id"].lower()
        if var_id in COLUMN_NAMES:
            rename[var_id] = COLUMN_NAMES[var_id]
        else:
            # Use the variable ID in lowercase as-is
            rename[var_id] = var_id

    # The value/content column in BULK format is named "INDHOLD"
    rename["indhold"] = "value"
    return rename
