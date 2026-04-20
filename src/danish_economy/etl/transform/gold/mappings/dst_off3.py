"""Map silver OFF3 → fct_economic_metric.

Reads the silver off3.parquet, resolves dimension keys via date-aware lookups,
and writes data/gold/fct_economic_metric.parquet.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[6] / "data"

# Map OFF3 sector text (from silver BULK format) → institution entity_key.
# Only the total row is mapped for now; sub-sectors can be added later.
SECTOR_TO_ENTITY: dict[str, str] = {
    "Offentlig forvaltning og service": "STAT",
}


def build_fct_economic_metric(data_dir: Path | None = None) -> Path:
    """Map OFF3 silver to fct_economic_metric in gold."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"

    # Load silver
    silver_path = base / "silver" / "dst" / "off3.parquet"
    if not silver_path.exists():
        raise FileNotFoundError(f"Silver OFF3 not found at {silver_path}")
    silver = pl.read_parquet(silver_path)

    # Load dimensions
    dim_metric = pl.read_parquet(gold_dir / "dim_metric.parquet")
    dim_date = pl.read_parquet(gold_dir / "dim_date.parquet")
    dim_source = pl.read_parquet(gold_dir / "dim_source.parquet")
    dim_institution = pl.read_parquet(gold_dir / "dim_institution.parquet")

    # Build metric lookup: source_identifier suffix → metric_key
    # source_identifier format: "OFF3:UI=<category text>"
    metric_lookup: dict[str, int] = {}
    for row in dim_metric.to_dicts():
        si = row["source_identifier"]
        if si.startswith("OFF3:UI="):
            category_text = si.split("=", 1)[1]
            metric_lookup[category_text] = row["metric_key"]

    # Source key for DST
    dst_source_key = dim_source.filter(
        pl.col("source_code") == "dst"
    )["source_key"][0]

    # Build date_key lookup
    date_keys: dict[str, int] = dict(
        zip(
            dim_date["date"].cast(pl.String).to_list(),
            dim_date["date_key"].to_list(),
        )
    )

    # Build institution lookup (date-aware: pick the row valid for the fact date)
    # For OFF3 annual data, we use Jan 1 of the year
    inst_current = dim_institution.filter(pl.col("is_current") == True)  # noqa: E712
    entity_keys_map: dict[str, int] = dict(
        zip(
            inst_current["entity_key"].to_list(),
            inst_current["inst_key"].to_list(),
        )
    )

    # Map silver rows to fact rows
    fact_rows: list[dict[str, int | float | None]] = []
    for row in silver.to_dicts():
        # Resolve metric
        category = row["category"]
        metric_key = metric_lookup.get(category)
        if metric_key is None:
            continue  # Skip categories we haven't mapped

        # Resolve date_key
        date_str = str(row["date"])
        date_key = date_keys.get(date_str)
        if date_key is None:
            continue

        # Resolve institution (sector → entity_key → inst_key)
        sector_text = row["sector"]
        entity_key = SECTOR_TO_ENTITY.get(sector_text)
        if entity_key is None:
            continue
        inst_key = entity_keys_map.get(entity_key)
        if inst_key is None:
            continue

        value = row["value"]
        if value is None:
            continue

        fact_rows.append(
            {
                "date_key": date_key,
                "inst_key": inst_key,
                "metric_key": metric_key,
                "source_key": dst_source_key,
                "value": value,
            }
        )

    if not fact_rows:
        raise ValueError("No fact rows produced from OFF3 mapping")

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

    output_path = gold_dir / "fct_economic_metric.parquet"
    fct.write_parquet(output_path)
    print(f"fct_economic_metric: {output_path} — {fct.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_fct_economic_metric()
