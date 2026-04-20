"""Build dim_metric from YAML seed."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
import yaml

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds"


def build_dim_metric(
    data_dir: Path | None = None,
    seed_path: Path | None = None,
) -> Path:
    """Generate dim_metric.parquet in the gold layer."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)

    path = seed_path or (SEEDS_DIR / "dim_metric.yaml")
    with open(path) as f:
        data = yaml.safe_load(f)

    rows: list[dict[str, Any]] = data["metrics"]

    df = pl.DataFrame(rows)
    # Add surrogate key
    df = df.with_columns(
        pl.Series(name="metric_key", values=list(range(1, len(df) + 1))),
    )
    df = df.select(
        "metric_key",
        "metric_code",
        "name_da",
        "name_en",
        "unit",
        "category",
        "subcategory",
        "source_system",
        "source_identifier",
    )

    output_path = gold_dir / "dim_metric.parquet"
    df.write_parquet(output_path)
    print(f"dim_metric: {output_path} — {df.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_dim_metric()
