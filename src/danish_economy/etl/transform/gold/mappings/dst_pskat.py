"""Map silver DST PSKAT (tax rates) → fct_economic_metric.

PSKAT has 3 tax rates per kommune per year:
  - Kommunal udskrivningsprocent (income tax %)
  - Kirkeskatteprocent (church tax %)
  - Grundskyldspromille (land tax promille)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[6] / "data"

# Map PSKAT tax type text → metric_code
TAX_TYPE_TO_METRIC: dict[str, str] = {
    "Kommunal udskrivningsprocent": "kommune_tax_rate",
    "Kirkeskatteprocent": "kommune_church_tax",
    "Grundskyldspromille": "kommune_land_tax",
}


def build_fct_pskat(data_dir: Path | None = None) -> Path:
    """Map PSKAT silver data to fct_economic_metric."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"

    silver_path = base / "silver" / "dst" / "pskat.parquet"
    if not silver_path.exists():
        raise FileNotFoundError(f"Silver PSKAT not found at {silver_path}")
    silver = pl.read_parquet(silver_path)

    dim_metric = pl.read_parquet(gold_dir / "dim_metric.parquet")
    dim_date = pl.read_parquet(gold_dir / "dim_date.parquet")
    dim_source = pl.read_parquet(gold_dir / "dim_source.parquet")
    dim_institution = pl.read_parquet(gold_dir / "dim_institution.parquet")

    # Build lookups
    metric_keys: dict[str, int] = {}
    for row in dim_metric.to_dicts():
        metric_keys[row["metric_code"]] = row["metric_key"]

    date_keys: dict[str, int] = dict(
        zip(
            dim_date["date"].cast(pl.String).to_list(),
            dim_date["date_key"].to_list(),
        )
    )

    dst_source_key: int = dim_source.filter(
        pl.col("source_code") == "dst"
    )["source_key"][0]

    # Kommune entity_key → inst_key (current rows)
    inst_current = dim_institution.filter(pl.col("is_current") == True)  # noqa: E712
    entity_to_inst: dict[str, int] = dict(
        zip(
            inst_current["entity_key"].to_list(),
            inst_current["inst_key"].to_list(),
        )
    )

    # Kommune area name → entity_key
    # PSKAT uses area names like "København", which we need to match to KOM_0101
    # We'll build a reverse lookup from name_da → entity_key for kommuner
    kommune_name_to_entity: dict[str, str] = {}
    for row in inst_current.filter(pl.col("inst_type") == "kommune").to_dicts():
        full_name = row["name_da"]
        kommune_name_to_entity[full_name] = row["entity_key"]
        # DST uses short names ("Silkeborg") without suffix
        if full_name.endswith(" Kommune"):
            short = full_name.removesuffix(" Kommune")
            kommune_name_to_entity[short] = row["entity_key"]

    fact_rows: list[dict[str, Any]] = []
    for row in silver.to_dicts():
        area = row.get("area")
        tax_type = row.get("skatpct")
        date_val = row.get("date")
        value = row.get("value")

        if area is None or tax_type is None or value is None:
            continue

        # Map tax type to metric
        metric_code = TAX_TYPE_TO_METRIC.get(str(tax_type))
        if metric_code is None:
            continue
        metric_key = metric_keys.get(metric_code)
        if metric_key is None:
            continue

        # Map date
        date_str = str(date_val)
        date_key = date_keys.get(date_str)
        if date_key is None:
            continue

        # Map area to institution
        entity_key = kommune_name_to_entity.get(str(area))
        if entity_key is None:
            continue
        inst_key = entity_to_inst.get(entity_key)
        if inst_key is None:
            continue

        fact_rows.append(
            {
                "date_key": date_key,
                "inst_key": inst_key,
                "metric_key": metric_key,
                "source_key": dst_source_key,
                "value": float(value),
            }
        )

    if not fact_rows:
        raise ValueError("No PSKAT fact rows produced")

    fct = pl.DataFrame(
        fact_rows,
        schema={
            "date_key": pl.Int32,
            "inst_key": pl.Int64,
            "metric_key": pl.Int64,
            "source_key": pl.Int64,
            "value": pl.Float64,
        },
    )

    # Append to existing fact table
    output_path = gold_dir / "fct_economic_metric.parquet"
    if output_path.exists():
        existing = pl.read_parquet(output_path)
        # Remove old PSKAT rows (same source + tax metrics)
        pskat_metric_keys = [
            metric_keys[mc]
            for mc in TAX_TYPE_TO_METRIC.values()
            if mc in metric_keys
        ]
        existing = existing.filter(
            ~(
                (pl.col("source_key") == dst_source_key)
                & pl.col("metric_key").is_in(pskat_metric_keys)
            )
        )
        fct = pl.concat([existing, fct])

    fct.write_parquet(output_path)
    print(f"fct_economic_metric (with PSKAT): {output_path} — {fct.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_fct_pskat()
