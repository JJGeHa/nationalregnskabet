"""Map silver Finanslov data to fct_economic_metric.

Aggregates account-level data to paragraf (ministry) level, maps paragraf
numbers to dim_institution entity keys, and writes fact rows.

Two metrics per paragraf per year:
  - fl_appropriation: the enacted Finanslov amount (F column)
  - fl_actual: the regnskab/actual amount (R column, lagged 2 years)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
import yaml

DATA_DIR = Path(__file__).resolve().parents[6] / "data"
SEEDS_DIR = Path(__file__).resolve().parents[3] / "seeds"


def _load_paragraf_mapping() -> dict[str, str]:
    """Load paragraf number → entity_key mapping from YAML."""
    path = SEEDS_DIR / "paragraf_mapping.yaml"
    with open(path) as f:
        data = yaml.safe_load(f)
    mapping: dict[str, str] = {}
    for par_nr, info in data["paragraffer"].items():
        mapping[str(par_nr).zfill(2)] = info["entity_key"]
    return mapping


def build_fct_finanslov(
    data_dir: Path | None = None,
    start_year: int = 2010,
    end_year: int = 2024,
) -> Path:
    """Build Finanslov fact rows from silver data."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"
    silver_dir = base / "silver" / "finanslov"

    paragraf_map = _load_paragraf_mapping()

    # Load dimensions
    dim_metric = pl.read_parquet(gold_dir / "dim_metric.parquet")
    dim_date = pl.read_parquet(gold_dir / "dim_date.parquet")
    dim_source = pl.read_parquet(gold_dir / "dim_source.parquet")
    dim_institution = pl.read_parquet(gold_dir / "dim_institution.parquet")

    # Metric keys for FL metrics
    fl_approp_key: int | None = None
    fl_actual_key: int | None = None
    for row in dim_metric.to_dicts():
        if row["metric_code"] == "fl_appropriation":
            fl_approp_key = row["metric_key"]
        elif row["metric_code"] == "fl_actual":
            fl_actual_key = row["metric_key"]
    if fl_approp_key is None or fl_actual_key is None:
        msg = "fl_appropriation or fl_actual metric not found in dim_metric"
        raise ValueError(msg)

    # Source key for finanslov
    fl_source = dim_source.filter(pl.col("source_code") == "finanslov")
    if fl_source.shape[0] == 0:
        msg = "finanslov source not found in dim_source"
        raise ValueError(msg)
    source_key: int = fl_source["source_key"][0]

    # Build date_key lookup (Jan 1 of each fiscal year)
    date_keys: dict[str, int] = dict(
        zip(
            dim_date["date"].cast(pl.String).to_list(),
            dim_date["date_key"].to_list(),
        )
    )

    # Build institution lookup (entity_key → inst_key for current rows)
    inst_current = dim_institution.filter(pl.col("is_current") == True)  # noqa: E712
    entity_to_inst: dict[str, int] = dict(
        zip(
            inst_current["entity_key"].to_list(),
            inst_current["inst_key"].to_list(),
        )
    )

    fact_rows: list[dict[str, Any]] = []

    for year in range(start_year, end_year + 1):
        yy = str(year)[-2:]
        silver_path = silver_dir / f"fl{yy}.parquet"
        if not silver_path.exists():
            continue

        df = pl.read_parquet(silver_path)

        # Aggregate to paragraf level: sum all account rows per paragraf
        agg = (
            df.group_by("paragraf_nr")
            .agg(
                pl.col("finanslov").sum().alias("finanslov_total"),
                pl.col("regnskab_minus2").sum().alias("regnskab_total"),
            )
        )

        date_str = f"{year}-01-01"
        date_key = date_keys.get(date_str)
        if date_key is None:
            continue

        # Date key for the regnskab year (FY-2)
        regnskab_year = year - 2
        regnskab_date_str = f"{regnskab_year}-01-01"
        regnskab_date_key = date_keys.get(regnskab_date_str)

        for row in agg.to_dicts():
            par_nr = str(row["paragraf_nr"]).zfill(2)
            entity_key = paragraf_map.get(par_nr)
            if entity_key is None:
                continue
            inst_key = entity_to_inst.get(entity_key)
            if inst_key is None:
                continue

            # Finanslov appropriation
            fl_val = row["finanslov_total"]
            if fl_val is not None:
                fact_rows.append(
                    {
                        "date_key": date_key,
                        "inst_key": inst_key,
                        "metric_key": fl_approp_key,
                        "source_key": source_key,
                        "value": fl_val,
                    }
                )

            # Regnskab (actual), attributed to the actual year
            reg_val = row["regnskab_total"]
            if reg_val is not None and regnskab_date_key is not None:
                fact_rows.append(
                    {
                        "date_key": regnskab_date_key,
                        "inst_key": inst_key,
                        "metric_key": fl_actual_key,
                        "source_key": source_key,
                        "value": reg_val,
                    }
                )

    if not fact_rows:
        raise ValueError("No Finanslov fact rows produced")

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

    # Deduplicate: if multiple FL years report R for the same year, keep latest
    fct = fct.unique(subset=["date_key", "inst_key", "metric_key"], keep="last")

    output_path = gold_dir / "fct_economic_metric.parquet"

    # Append to existing fact table if it exists
    if output_path.exists():
        existing = pl.read_parquet(output_path)
        # Remove any existing FL rows to avoid duplicates on rebuild
        existing = existing.filter(pl.col("source_key") != source_key)
        fct = pl.concat([existing, fct])

    fct.write_parquet(output_path)
    print(f"fct_economic_metric (with FL): {output_path} — {fct.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_fct_finanslov()
