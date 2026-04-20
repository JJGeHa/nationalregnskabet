"""Build dim_institution from YAML seed + DST kommune/region register.

Writes data/gold/dim_institution.parquet as an SCD Type 2 table.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import polars as pl
import yaml

from danish_economy.etl.ingest.dst.client import DSTClient
from danish_economy.etl.transform.gold.scd2 import merge_scd2

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds"

# DST region code → entity_key mapping
REGION_MAP: dict[str, str] = {
    "084": "REG_HOVEDSTADEN",
    "085": "REG_SJAELLAND",
    "083": "REG_SYDDANMARK",
    "082": "REG_MIDTJYLLAND",
    "081": "REG_NORDJYLLAND",
}

LOGICAL_COLS = [
    "entity_key",
    "name_da",
    "name_en",
    "inst_type",
    "inst_subtype",
    "sector_esa2010",
    "is_general_government",
    "parent_entity_key",
    "geo_code",
    "geo_level",
]

SCHEMA: dict[str, pl.DataType] = {
    "inst_key": pl.Int64(),
    "entity_key": pl.String(),
    "name_da": pl.String(),
    "name_en": pl.String(),
    "inst_type": pl.String(),
    "inst_subtype": pl.String(),
    "sector_esa2010": pl.String(),
    "is_general_government": pl.Boolean(),
    "parent_entity_key": pl.String(),
    "hierarchy_path": pl.String(),
    "hierarchy_depth": pl.Int32(),
    "geo_code": pl.String(),
    "geo_level": pl.String(),
    "valid_from": pl.Date(),
    "valid_to": pl.Date(),
    "is_current": pl.Boolean(),
    "source_system": pl.String(),
    "loaded_at": pl.Datetime("us"),
    "record_hash": pl.UInt64(),
}


def load_seed_yaml(seed_path: Path | None = None) -> list[dict[str, Any]]:
    """Load the hand-curated institution seed file."""
    path = seed_path or (SEEDS_DIR / "dim_institution.yaml")
    with open(path) as f:
        data = yaml.safe_load(f)
    result: list[dict[str, Any]] = data["institutions"]
    return result


def fetch_kommuner_from_dst() -> list[dict[str, Any]]:
    """Fetch the 98 kommuner from DST's FOLK1A OMRÅDE variable."""
    with DSTClient() as client:
        meta = client.get_metadata("FOLK1A")

    # Find the OMRÅDE variable
    for v in meta.variables:
        if v.id == "OMRÅDE":
            area_values = v.values
            break
    else:
        raise ValueError("OMRÅDE variable not found in FOLK1A metadata")

    # Separate regions and kommuner
    kommuner: list[dict[str, Any]] = []
    current_region: str | None = None

    for entry in area_values:
        code = entry["id"]
        name_da = entry["text"]

        # Skip "Hele landet" (000)
        if code == "000":
            continue

        # Region codes: 081–085
        if code in REGION_MAP:
            current_region = REGION_MAP[code]
            continue

        # Everything else is a kommune
        if current_region is None:
            continue

        kommuner.append(
            {
                "entity_key": f"KOM_{code.zfill(4)}",
                "name_da": f"{name_da} Kommune",
                "name_en": f"{name_da} Municipality",
                "inst_type": "kommune",
                "inst_subtype": None,
                "sector_esa2010": "S1313",
                "is_general_government": True,
                "parent_entity_key": current_region,
                "geo_code": code.zfill(4),
                "geo_level": "kommune",
            }
        )

    return kommuner


def build_institution_df(
    seed_path: Path | None = None,
    *,
    fetch_kommuner: bool = True,
) -> pl.DataFrame:
    """Build the full institution snapshot from seed + DST register."""
    rows = load_seed_yaml(seed_path)

    if fetch_kommuner:
        kommuner = fetch_kommuner_from_dst()
        rows.extend(kommuner)

    # Normalize None values
    for row in rows:
        for key in LOGICAL_COLS:
            if key not in row:
                row[key] = None

    df = pl.DataFrame(rows).select(LOGICAL_COLS)

    # Compute hierarchy
    df = _compute_hierarchy(df)

    # Add metadata columns
    now = datetime.now(UTC)
    df = df.with_columns(
        pl.lit("seed+dst").alias("source_system"),
        pl.lit(now).alias("loaded_at"),
    )

    return df


def _compute_hierarchy(df: pl.DataFrame) -> pl.DataFrame:
    """Compute hierarchy_path and hierarchy_depth from parent pointers."""
    # Build a parent lookup
    entities = df.select("entity_key", "parent_entity_key").to_dicts()
    parent_map: dict[str, str | None] = {
        e["entity_key"]: e["parent_entity_key"] for e in entities
    }

    paths: list[str] = []
    depths: list[int] = []

    for entity in df["entity_key"].to_list():
        chain: list[str] = []
        current: str | None = entity
        seen: set[str] = set()
        while current is not None and current not in seen:
            chain.append(current)
            seen.add(current)
            current = parent_map.get(current)
        chain.reverse()
        paths.append("/".join(chain))
        depths.append(len(chain) - 1)

    return df.with_columns(
        pl.Series(name="hierarchy_path", values=paths),
        pl.Series(name="hierarchy_depth", values=depths, dtype=pl.Int32),
    )


def build_dim_institution(
    data_dir: Path | None = None,
    seed_path: Path | None = None,
    *,
    fetch_kommuner: bool = True,
    change_date: date | None = None,
) -> Path:
    """Build or update dim_institution.parquet in the gold layer.

    On first run, creates the initial load. On subsequent runs, performs
    SCD2 merge against the existing file.
    """
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)
    output_path = gold_dir / "dim_institution.parquet"

    effective_date = change_date or date(2025, 1, 1)
    incoming = build_institution_df(seed_path, fetch_kommuner=fetch_kommuner)

    # Load existing or create empty
    if output_path.exists():
        existing = pl.read_parquet(output_path)
    else:
        existing = pl.DataFrame(schema=SCHEMA)

    result = merge_scd2(
        existing=existing,
        incoming=incoming,
        entity_key_col="entity_key",
        surrogate_key_col="inst_key",
        logical_cols=LOGICAL_COLS,
        hash_col="record_hash",
        change_date=effective_date,
    )

    # Ensure all schema columns exist and order matches
    for col_name, col_type in SCHEMA.items():
        if col_name not in result.columns:
            result = result.with_columns(pl.lit(None).cast(col_type).alias(col_name))
    result = result.select(list(SCHEMA.keys()))

    result.write_parquet(output_path)
    print(f"dim_institution: {output_path} — {result.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_dim_institution()
