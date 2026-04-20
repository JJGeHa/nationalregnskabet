"""Tests for the DST silver transform."""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

import polars as pl
import pytest

from danish_economy.etl.transform.silver.dst import (
    find_latest_bronze_run,
    parse_dst_date,
    transform_table,
)

FIXTURES = Path(__file__).parent / "fixtures" / "dst"


class TestParseDstDate:
    def test_yearly(self) -> None:
        assert parse_dst_date("2024") == date(2024, 1, 1)

    def test_quarterly_k1(self) -> None:
        assert parse_dst_date("2024K1") == date(2024, 1, 1)

    def test_quarterly_k2(self) -> None:
        assert parse_dst_date("2024K2") == date(2024, 4, 1)

    def test_quarterly_k3(self) -> None:
        assert parse_dst_date("2024K3") == date(2024, 7, 1)

    def test_quarterly_k4(self) -> None:
        assert parse_dst_date("2024K4") == date(2024, 10, 1)

    def test_quarterly_with_leading_zero(self) -> None:
        assert parse_dst_date("2024K01") == date(2024, 1, 1)

    def test_monthly(self) -> None:
        assert parse_dst_date("2024M03") == date(2024, 3, 1)

    def test_monthly_without_leading_zero(self) -> None:
        assert parse_dst_date("2024M3") == date(2024, 3, 1)

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(ValueError, match="Unrecognised"):
            parse_dst_date("not-a-date")


class TestFindLatestBronzeRun:
    def test_finds_latest(self, tmp_path: Path) -> None:
        bronze = tmp_path / "bronze" / "dst" / "OFF3"
        (bronze / "run_date=2025-01-01").mkdir(parents=True)
        (bronze / "run_date=2025-01-15").mkdir(parents=True)
        (bronze / "run_date=2025-01-10").mkdir(parents=True)

        result = find_latest_bronze_run("OFF3", tmp_path)
        assert result.name == "run_date=2025-01-15"

    def test_raises_if_no_table(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError, match="No bronze data"):
            find_latest_bronze_run("NOPE", tmp_path)

    def test_raises_if_no_runs(self, tmp_path: Path) -> None:
        bronze = tmp_path / "bronze" / "dst" / "OFF3"
        bronze.mkdir(parents=True)
        with pytest.raises(FileNotFoundError, match="No runs found"):
            find_latest_bronze_run("OFF3", tmp_path)


class TestTransformTable:
    def _setup_bronze(self, tmp_path: Path) -> Path:
        """Set up a fake bronze directory from fixtures."""
        run_dir = tmp_path / "bronze" / "dst" / "OFF3" / "run_date=2025-01-15"
        run_dir.mkdir(parents=True)
        shutil.copy(FIXTURES / "OFF3_metadata.json", run_dir / "metadata.json")
        shutil.copy(FIXTURES / "OFF3_raw.csv", run_dir / "raw.csv")
        return run_dir

    def test_produces_silver_parquet(self, tmp_path: Path) -> None:
        self._setup_bronze(tmp_path)
        output = transform_table("OFF3", data_dir=tmp_path)

        assert output.exists()
        assert output.suffix == ".parquet"
        assert output.name == "off3.parquet"

    def test_columns_renamed_to_english(self, tmp_path: Path) -> None:
        self._setup_bronze(tmp_path)
        transform_table("OFF3", data_dir=tmp_path)

        df = pl.read_parquet(tmp_path / "silver" / "dst" / "off3.parquet")
        assert "category" in df.columns  # UI → category
        assert "sector" in df.columns  # SEKTOR → sector
        assert "date" in df.columns  # TID → date
        assert "value" in df.columns  # INDHOLD → value
        # Original DST names should be gone
        assert "UI" not in df.columns
        assert "SEKTOR" not in df.columns

    def test_dates_parsed_as_date_type(self, tmp_path: Path) -> None:
        self._setup_bronze(tmp_path)
        transform_table("OFF3", data_dir=tmp_path)

        df = pl.read_parquet(tmp_path / "silver" / "dst" / "off3.parquet")
        assert df["date"].dtype == pl.Date
        assert date(2020, 1, 1) in df["date"].to_list()

    def test_missing_values_handled(self, tmp_path: Path) -> None:
        """DST uses '..' for missing values — these should become null."""
        self._setup_bronze(tmp_path)
        transform_table("OFF3", data_dir=tmp_path)

        df = pl.read_parquet(tmp_path / "silver" / "dst" / "off3.parquet")
        # The fixture has ".." for 2024 TOTAL row
        total_2024 = df.filter(
            (pl.col("category") == "1")
            & (pl.col("sector") == "TOTAL")
            & (pl.col("date") == date(2024, 1, 1))
        )
        assert total_2024.shape[0] == 1
        assert total_2024["value"][0] is None

    def test_no_duplicate_rows(self, tmp_path: Path) -> None:
        self._setup_bronze(tmp_path)
        transform_table("OFF3", data_dir=tmp_path)

        df = pl.read_parquet(tmp_path / "silver" / "dst" / "off3.parquet")
        assert df.shape[0] == df.unique().shape[0]

    def test_value_column_is_float(self, tmp_path: Path) -> None:
        self._setup_bronze(tmp_path)
        transform_table("OFF3", data_dir=tmp_path)

        df = pl.read_parquet(tmp_path / "silver" / "dst" / "off3.parquet")
        assert df["value"].dtype == pl.Float64
