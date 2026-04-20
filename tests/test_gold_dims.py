"""Tests for gold dimension builders: dim_date, dim_metric, dim_source."""

from datetime import date
from pathlib import Path

import polars as pl

from danish_economy.etl.transform.gold.dim_date import build_dim_date
from danish_economy.etl.transform.gold.dim_metric import build_dim_metric
from danish_economy.etl.transform.gold.dim_source import build_dim_source


class TestDimDate:
    def test_produces_parquet(self, tmp_path: Path) -> None:
        path = build_dim_date(
            data_dir=tmp_path, start=date(2020, 1, 1), end=date(2020, 12, 31)
        )
        assert path.exists()
        assert path.suffix == ".parquet"

    def test_row_count_matches_range(self, tmp_path: Path) -> None:
        build_dim_date(
            data_dir=tmp_path, start=date(2020, 1, 1), end=date(2020, 12, 31)
        )
        df = pl.read_parquet(tmp_path / "gold" / "dim_date.parquet")
        assert df.shape[0] == 366  # 2020 is a leap year

    def test_date_key_format(self, tmp_path: Path) -> None:
        build_dim_date(
            data_dir=tmp_path, start=date(2024, 6, 15), end=date(2024, 6, 15)
        )
        df = pl.read_parquet(tmp_path / "gold" / "dim_date.parquet")
        assert df["date_key"][0] == 20240615

    def test_no_date_key_overflow(self, tmp_path: Path) -> None:
        """Ensure month * 100 doesn't overflow i8 for months >= 2."""
        build_dim_date(
            data_dir=tmp_path, start=date(2023, 6, 1), end=date(2023, 6, 30)
        )
        df = pl.read_parquet(tmp_path / "gold" / "dim_date.parquet")
        # If i8 overflow occurs, date_key for June would be wrong
        assert df["date_key"][0] == 20230601

    def test_columns_present(self, tmp_path: Path) -> None:
        build_dim_date(
            data_dir=tmp_path, start=date(2020, 1, 1), end=date(2020, 1, 1)
        )
        df = pl.read_parquet(tmp_path / "gold" / "dim_date.parquet")
        expected = {
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
        }
        assert set(df.columns) == expected

    def test_danish_month_names(self, tmp_path: Path) -> None:
        build_dim_date(
            data_dir=tmp_path, start=date(2020, 3, 1), end=date(2020, 3, 1)
        )
        df = pl.read_parquet(tmp_path / "gold" / "dim_date.parquet")
        assert df["month_name_da"][0] == "marts"
        assert df["month_name_en"][0] == "March"


class TestDimMetric:
    def test_produces_parquet(self, tmp_path: Path) -> None:
        path = build_dim_metric(data_dir=tmp_path)
        assert path.exists()

    def test_has_12_metrics(self, tmp_path: Path) -> None:
        build_dim_metric(data_dir=tmp_path)
        df = pl.read_parquet(tmp_path / "gold" / "dim_metric.parquet")
        assert df.shape[0] == 12

    def test_metric_keys_unique(self, tmp_path: Path) -> None:
        build_dim_metric(data_dir=tmp_path)
        df = pl.read_parquet(tmp_path / "gold" / "dim_metric.parquet")
        assert df["metric_key"].n_unique() == df.shape[0]

    def test_public_balance_exists(self, tmp_path: Path) -> None:
        build_dim_metric(data_dir=tmp_path)
        df = pl.read_parquet(tmp_path / "gold" / "dim_metric.parquet")
        balance = df.filter(pl.col("metric_code") == "public_balance")
        assert balance.shape[0] == 1
        assert balance["unit"][0] == "DKK_mio"


class TestDimSource:
    def test_produces_parquet(self, tmp_path: Path) -> None:
        path = build_dim_source(data_dir=tmp_path)
        assert path.exists()

    def test_has_4_sources(self, tmp_path: Path) -> None:
        build_dim_source(data_dir=tmp_path)
        df = pl.read_parquet(tmp_path / "gold" / "dim_source.parquet")
        assert df.shape[0] == 4

    def test_dst_source_present(self, tmp_path: Path) -> None:
        build_dim_source(data_dir=tmp_path)
        df = pl.read_parquet(tmp_path / "gold" / "dim_source.parquet")
        dst = df.filter(pl.col("source_code") == "dst")
        assert dst.shape[0] == 1
