"""Tests for the OFF3 → fct_economic_metric gold mapping."""

from pathlib import Path

import polars as pl

from danish_economy.etl.transform.gold.mappings.dst_off3 import (
    build_fct_economic_metric,
)

# These tests use the real data/gold Parquet files.
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class TestFctEconomicMetric:
    def test_produces_parquet(self) -> None:
        path = build_fct_economic_metric()
        assert path.exists()
        assert path.suffix == ".parquet"

    def test_has_expected_columns(self) -> None:
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        expected = {"date_key", "inst_key", "metric_key", "source_key", "value"}
        assert set(fct.columns) == expected

    def test_row_count_is_plausible(self) -> None:
        """12 metrics × ~36 years = ~432 rows."""
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        assert fct.shape[0] >= 300  # at least 300 rows
        assert fct.shape[0] <= 700  # not more than 700

    def test_no_null_values(self) -> None:
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        for col in fct.columns:
            assert fct[col].null_count() == 0, f"Nulls found in {col}"

    def test_date_keys_are_valid(self) -> None:
        """All date_keys should be valid YYYYMMDD integers."""
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        dim_date = pl.read_parquet(DATA_DIR / "gold" / "dim_date.parquet")
        valid_keys = set(dim_date["date_key"].to_list())
        fact_keys = set(fct["date_key"].to_list())
        assert fact_keys.issubset(valid_keys), "Fact has date_keys not in dim_date"

    def test_metric_keys_are_valid(self) -> None:
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        dim_metric = pl.read_parquet(DATA_DIR / "gold" / "dim_metric.parquet")
        valid_keys = set(dim_metric["metric_key"].to_list())
        fact_keys = set(fct["metric_key"].to_list())
        assert fact_keys.issubset(valid_keys), "Fact has metric_keys not in dim_metric"

    def test_all_12_metrics_represented(self) -> None:
        fct = pl.read_parquet(DATA_DIR / "gold" / "fct_economic_metric.parquet")
        assert fct["metric_key"].n_unique() == 12
