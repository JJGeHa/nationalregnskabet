"""Tests for dim_institution: integrity checks on the built dimension."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import polars as pl
import pytest

from danish_economy.etl.transform.gold.dim_institution import (
    build_institution_df,
    load_seed_yaml,
)
from danish_economy.etl.transform.gold.scd2 import END_OF_TIME, merge_scd2

SEEDS_DIR = Path(__file__).parent.parent / "src" / "danish_economy" / "etl" / "seeds"

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


def _build_and_merge(fetch_kommuner: bool = False) -> pl.DataFrame:
    """Build institution DF and run it through SCD2 merge (initial load)."""
    df = build_institution_df(fetch_kommuner=fetch_kommuner)
    existing = pl.DataFrame(schema=SCHEMA)
    result = merge_scd2(
        existing=existing,
        incoming=df,
        entity_key_col="entity_key",
        surrogate_key_col="inst_key",
        logical_cols=LOGICAL_COLS,
        hash_col="record_hash",
        change_date=date(2025, 1, 1),
    )
    # Add missing columns
    for col_name, col_type in SCHEMA.items():
        if col_name not in result.columns:
            result = result.with_columns(pl.lit(None).cast(col_type).alias(col_name))
    return result.select(list(SCHEMA.keys()))


class TestSeedData:
    def test_seed_loads(self) -> None:
        rows = load_seed_yaml()
        assert len(rows) > 0

    def test_seed_has_stat_root(self) -> None:
        rows = load_seed_yaml()
        entity_keys = [r["entity_key"] for r in rows]
        assert "STAT" in entity_keys

    def test_seed_has_ministerier(self) -> None:
        rows = load_seed_yaml()
        ministerier = [r for r in rows if r["inst_type"] == "ministerium"]
        assert len(ministerier) >= 15

    def test_seed_has_styrelser(self) -> None:
        rows = load_seed_yaml()
        styrelser = [r for r in rows if r["inst_type"] == "styrelse"]
        assert len(styrelser) >= 20

    def test_seed_has_regioner(self) -> None:
        rows = load_seed_yaml()
        regioner = [r for r in rows if r["inst_type"] == "region"]
        assert len(regioner) == 5


class TestIntegrity:
    """Integrity checks — run on seed-only data (no DST fetch)."""

    @pytest.fixture()
    def dim(self) -> pl.DataFrame:
        return _build_and_merge(fetch_kommuner=False)

    def test_unique_inst_key(self, dim: pl.DataFrame) -> None:
        keys = dim["inst_key"].to_list()
        assert len(keys) == len(set(keys))

    def test_no_overlapping_validity(self, dim: pl.DataFrame) -> None:
        """For every entity_key, valid_from/valid_to ranges don't overlap."""
        for ek in dim["entity_key"].unique().to_list():
            rows = dim.filter(pl.col("entity_key") == ek).sort("valid_from")
            dates = rows.select("valid_from", "valid_to").to_dicts()
            for i in range(len(dates) - 1):
                assert dates[i]["valid_to"] < dates[i + 1]["valid_from"]

    def test_referential_integrity(self, dim: pl.DataFrame) -> None:
        """Every non-root row's parent_entity_key resolves to an existing entity_key."""
        all_entity_keys = set(dim["entity_key"].unique().to_list())
        parents = dim.filter(pl.col("parent_entity_key").is_not_null())[
            "parent_entity_key"
        ].to_list()
        for parent in parents:
            assert parent in all_entity_keys, f"Orphan parent: {parent}"

    def test_hierarchy_path_matches_parents(self, dim: pl.DataFrame) -> None:
        """hierarchy_path should match the chain of parent_entity_key references."""
        current = dim.filter(pl.col("is_current") == True)  # noqa: E712
        parent_map: dict[str, str | None] = dict(
            zip(
                current["entity_key"].to_list(),
                current["parent_entity_key"].to_list(),
            )
        )

        for row in current.to_dicts():
            path = row["hierarchy_path"]
            if path is None:
                continue
            parts = path.split("/")
            assert parts[-1] == row["entity_key"]

            # Verify chain
            for i in range(len(parts) - 1, 0, -1):
                expected_parent = parent_map.get(parts[i])
                assert expected_parent == parts[i - 1], (
                    f"Hierarchy mismatch for {row['entity_key']}: "
                    f"expected {expected_parent} at position {i-1}, got {parts[i-1]}"
                )

    def test_is_current_matches_valid_to(self, dim: pl.DataFrame) -> None:
        """is_current = True iff valid_to = 9999-12-31."""
        for row in dim.to_dicts():
            if row["is_current"]:
                assert row["valid_to"] == END_OF_TIME
            else:
                assert row["valid_to"] != END_OF_TIME

    def test_stat_is_root(self, dim: pl.DataFrame) -> None:
        stat = dim.filter(pl.col("entity_key") == "STAT")
        assert stat.shape[0] == 1
        assert stat["parent_entity_key"][0] is None
        assert stat["hierarchy_depth"][0] == 0
        assert stat["hierarchy_path"][0] == "STAT"
