"""Tests for the generic SCD Type 2 merge utility."""

from __future__ import annotations

from datetime import date

import polars as pl

from danish_economy.etl.transform.gold.scd2 import END_OF_TIME, merge_scd2

ENTITY_KEY = "entity_key"
SURROGATE_KEY = "inst_key"
HASH_COL = "record_hash"
LOGICAL_COLS = ["entity_key", "name", "parent"]

SCHEMA = {
    "inst_key": pl.Int64,
    "entity_key": pl.String,
    "name": pl.String,
    "parent": pl.String,
    "record_hash": pl.UInt64,
    "valid_from": pl.Date,
    "valid_to": pl.Date,
    "is_current": pl.Boolean,
}


def _empty() -> pl.DataFrame:
    return pl.DataFrame(schema=SCHEMA)


def _incoming(rows: list[dict]) -> pl.DataFrame:  # type: ignore[type-arg]
    """Build an incoming snapshot (no SCD2 columns)."""
    return pl.DataFrame(
        rows,
        schema={"entity_key": pl.String, "name": pl.String, "parent": pl.String},
    )


def _merge(
    existing: pl.DataFrame,
    incoming: pl.DataFrame,
    change_date: date = date(2025, 6, 1),
) -> pl.DataFrame:
    return merge_scd2(
        existing=existing,
        incoming=incoming,
        entity_key_col=ENTITY_KEY,
        surrogate_key_col=SURROGATE_KEY,
        logical_cols=LOGICAL_COLS,
        hash_col=HASH_COL,
        change_date=change_date,
    )


class TestInitialLoad:
    def test_new_entities_added(self) -> None:
        incoming = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
            {"entity_key": "B", "name": "Beta", "parent": "A"},
        ])
        result = _merge(_empty(), incoming)

        assert result.shape[0] == 2
        assert set(result["entity_key"].to_list()) == {"A", "B"}

    def test_scd2_columns_set(self) -> None:
        incoming = _incoming([{"entity_key": "A", "name": "Alpha", "parent": None}])
        result = _merge(_empty(), incoming, change_date=date(2025, 1, 1))

        row = result.row(0, named=True)
        assert row["valid_from"] == date(2025, 1, 1)
        assert row["valid_to"] == END_OF_TIME
        assert row["is_current"] is True

    def test_surrogate_keys_unique(self) -> None:
        incoming = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
            {"entity_key": "B", "name": "Beta", "parent": "A"},
            {"entity_key": "C", "name": "Gamma", "parent": "A"},
        ])
        result = _merge(_empty(), incoming)
        keys = result["inst_key"].to_list()
        assert len(keys) == len(set(keys))


class TestUnchangedEntity:
    def test_unchanged_rows_preserved(self) -> None:
        """An entity with identical logical columns should not create a new version."""
        incoming = _incoming([{"entity_key": "A", "name": "Alpha", "parent": None}])
        load1 = _merge(_empty(), incoming, change_date=date(2025, 1, 1))

        # Merge again with same data
        load2 = _merge(load1, incoming, change_date=date(2025, 6, 1))

        assert load2.shape[0] == 1  # No new version
        row = load2.row(0, named=True)
        assert row["valid_from"] == date(2025, 1, 1)
        assert row["valid_to"] == END_OF_TIME
        assert row["is_current"] is True


class TestChangedEntity:
    def test_styrelse_moves_between_ministerier(self) -> None:
        """Simulate a styrelse moving from ministerium A to B.

        The old row should close (valid_to = change_date - 1 day) and a new
        row should open (valid_from = change_date). Both share entity_key but
        have different inst_keys.
        """
        # Initial load: STY under MIN_A
        incoming_v1 = _incoming([
            {"entity_key": "STY_X", "name": "Styrelse X", "parent": "MIN_A"},
        ])
        load1 = _merge(_empty(), incoming_v1, change_date=date(2025, 1, 1))

        # Move: STY under MIN_B
        incoming_v2 = _incoming([
            {"entity_key": "STY_X", "name": "Styrelse X", "parent": "MIN_B"},
        ])
        load2 = _merge(load1, incoming_v2, change_date=date(2025, 6, 1))

        assert load2.shape[0] == 2

        # Both rows share entity_key
        assert all(k == "STY_X" for k in load2["entity_key"].to_list())

        # Different surrogate keys
        keys = load2["inst_key"].to_list()
        assert keys[0] != keys[1]

        # Old row closed out
        old_row = load2.filter(pl.col("is_current") == False).row(0, named=True)  # noqa: E712
        assert old_row["valid_to"] == date(2025, 5, 31)
        assert old_row["parent"] == "MIN_A"

        # New row opened
        new_row = load2.filter(pl.col("is_current") == True).row(0, named=True)  # noqa: E712
        assert new_row["valid_from"] == date(2025, 6, 1)
        assert new_row["valid_to"] == END_OF_TIME
        assert new_row["parent"] == "MIN_B"


class TestNewEntity:
    def test_new_entity_appended(self) -> None:
        """A brand new entity should be appended without affecting existing rows."""
        incoming_v1 = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
        ])
        load1 = _merge(_empty(), incoming_v1, change_date=date(2025, 1, 1))

        incoming_v2 = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
            {"entity_key": "B", "name": "Beta", "parent": "A"},
        ])
        load2 = _merge(load1, incoming_v2, change_date=date(2025, 6, 1))

        assert load2.shape[0] == 2

        a_row = load2.filter(pl.col("entity_key") == "A").row(0, named=True)
        assert a_row["valid_from"] == date(2025, 1, 1)  # Unchanged
        assert a_row["is_current"] is True

        b_row = load2.filter(pl.col("entity_key") == "B").row(0, named=True)
        assert b_row["valid_from"] == date(2025, 6, 1)
        assert b_row["is_current"] is True


class TestDeletedEntity:
    def test_deleted_entity_closed_not_removed(self) -> None:
        """An entity missing from the new snapshot should be closed out, not deleted."""
        incoming_v1 = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
            {"entity_key": "B", "name": "Beta", "parent": "A"},
        ])
        load1 = _merge(_empty(), incoming_v1, change_date=date(2025, 1, 1))

        # B disappears
        incoming_v2 = _incoming([
            {"entity_key": "A", "name": "Alpha", "parent": None},
        ])
        load2 = _merge(load1, incoming_v2, change_date=date(2025, 6, 1))

        assert load2.shape[0] == 2  # B still exists, just closed

        b_row = load2.filter(pl.col("entity_key") == "B").row(0, named=True)
        assert b_row["is_current"] is False
        assert b_row["valid_to"] == date(2025, 5, 31)

        a_row = load2.filter(pl.col("entity_key") == "A").row(0, named=True)
        assert a_row["is_current"] is True


class TestValidityRanges:
    def test_no_overlapping_ranges(self) -> None:
        """For each entity_key, valid_from/valid_to ranges must not overlap."""
        incoming_v1 = _incoming([
            {"entity_key": "X", "name": "Version 1", "parent": None},
        ])
        load1 = _merge(_empty(), incoming_v1, change_date=date(2025, 1, 1))

        incoming_v2 = _incoming([
            {"entity_key": "X", "name": "Version 2", "parent": None},
        ])
        load2 = _merge(load1, incoming_v2, change_date=date(2025, 6, 1))

        incoming_v3 = _incoming([
            {"entity_key": "X", "name": "Version 3", "parent": None},
        ])
        load3 = _merge(load2, incoming_v3, change_date=date(2026, 1, 1))

        # Check no overlapping ranges for entity X
        rows = load3.filter(pl.col("entity_key") == "X").sort("valid_from")
        dates = rows.select("valid_from", "valid_to").to_dicts()

        for i in range(len(dates) - 1):
            assert dates[i]["valid_to"] < dates[i + 1]["valid_from"]
