"""Build dim_date: standard date dimension, daily grain 1990–2050."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[5] / "data"

# Danish month names
MONTH_NAMES_DA = [
    "",
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december",
]

MONTH_NAMES_EN = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def build_dim_date(
    data_dir: Path | None = None,
    start: date = date(1990, 1, 1),
    end: date = date(2050, 12, 31),
) -> Path:
    """Generate dim_date.parquet in the gold layer."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)

    dates = pl.date_range(start, end, eager=True).alias("date")
    df = pl.DataFrame({"date": dates})

    df = df.with_columns(
        # date_key: YYYYMMDD integer (cast components to Int32 to avoid i8 overflow)
        (
            pl.col("date").dt.year().cast(pl.Int32) * 10000
            + pl.col("date").dt.month().cast(pl.Int32) * 100
            + pl.col("date").dt.day().cast(pl.Int32)
        ).alias("date_key"),
        pl.col("date").dt.year().cast(pl.Int32).alias("year"),
        pl.col("date").dt.quarter().alias("quarter"),
        pl.col("date").dt.month().cast(pl.Int32).alias("month"),
        pl.col("date").dt.day().cast(pl.Int32).alias("day"),
        pl.col("date").dt.iso_year().alias("iso_year"),
        pl.col("date").dt.week().alias("iso_week"),
        (pl.col("date").dt.weekday() >= 6).alias("is_weekend"),
    )

    # Month names
    df = df.with_columns(
        pl.col("month")
        .map_elements(lambda m: MONTH_NAMES_DA[m], return_dtype=pl.String)
        .alias("month_name_da"),
        pl.col("month")
        .map_elements(lambda m: MONTH_NAMES_EN[m], return_dtype=pl.String)
        .alias("month_name_en"),
    )

    # Danish fiscal year = calendar year
    df = df.with_columns(pl.col("year").alias("fiscal_year_dk"))

    # Select final column order
    df = df.select(
        "date_key",
        "date",
        "year",
        "quarter",
        "month",
        "month_name_da",
        "month_name_en",
        "day",
        "iso_week",
        "is_weekend",
        "fiscal_year_dk",
    )

    output_path = gold_dir / "dim_date.parquet"
    df.write_parquet(output_path)
    print(f"dim_date: {output_path} — {df.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_dim_date()
