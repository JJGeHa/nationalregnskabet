"""Generic SCD Type 2 merge utility.

Given an existing dimension DataFrame and a new snapshot, produces a merged
DataFrame where:
  - Unchanged rows are kept as-is.
  - Changed rows have the old version closed out (valid_to = change_date - 1 day)
    and a new version appended (valid_from = change_date).
  - New entities are appended with valid_from = change_date.
  - Deleted entities (present in existing, absent in new) are closed out.
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

END_OF_TIME = date(9999, 12, 31)


def merge_scd2(
    existing: pl.DataFrame,
    incoming: pl.DataFrame,
    entity_key_col: str,
    surrogate_key_col: str,
    logical_cols: list[str],
    hash_col: str,
    change_date: date,
    *,
    next_surrogate: int | None = None,
) -> pl.DataFrame:
    """Merge incoming snapshot into an existing SCD2 dimension.

    Parameters
    ----------
    existing:
        Current dimension table (may be empty for initial load).
    incoming:
        New snapshot of dimension data. Must contain entity_key_col and all
        logical_cols. Does NOT need surrogate keys or SCD2 columns.
    entity_key_col:
        The business key column (stable across versions).
    surrogate_key_col:
        The surrogate key column (unique per row/version).
    logical_cols:
        Columns that, when changed, trigger a new SCD2 version.
    hash_col:
        Column name for the record hash (computed from logical_cols).
    change_date:
        The effective date for new/changed versions.
    next_surrogate:
        Starting value for new surrogate keys. If None, auto-computed from
        the max existing surrogate key + 1.

    Returns
    -------
    A new DataFrame with the merged SCD2 result.
    """
    close_date = change_date - timedelta(days=1)

    # Compute hash on incoming data
    incoming = _compute_hash(incoming, logical_cols, hash_col)

    # Get current rows from existing
    if existing.is_empty():
        current_rows = pl.DataFrame(schema=existing.schema)
    else:
        current_rows = existing.filter(pl.col("is_current") == True)  # noqa: E712

    # Determine next surrogate key
    if next_surrogate is None:
        if existing.is_empty():
            next_surrogate = 1
        else:
            max_val = existing[surrogate_key_col].max()
            next_surrogate = (int(str(max_val)) if max_val is not None else 0) + 1

    # Match incoming to current by entity_key
    incoming_keys = set(incoming[entity_key_col].to_list())
    if not current_rows.is_empty():
        current_keys = set(current_rows[entity_key_col].to_list())
    else:
        current_keys = set()

    new_keys = incoming_keys - current_keys
    deleted_keys = current_keys - incoming_keys
    common_keys = incoming_keys & current_keys

    # Identify changed entities among common keys
    changed_keys: set[str] = set()
    if common_keys and not current_rows.is_empty():
        current_hashes = dict(
            zip(
                current_rows[entity_key_col].to_list(),
                current_rows[hash_col].to_list(),
            )
        )
        incoming_hashes = dict(
            zip(
                incoming[entity_key_col].to_list(),
                incoming[hash_col].to_list(),
            )
        )
        for key in common_keys:
            if current_hashes.get(key) != incoming_hashes.get(key):
                changed_keys.add(key)

    # Build result parts
    parts: list[pl.DataFrame] = []

    # 1. Historical (non-current) rows: keep unchanged
    if not existing.is_empty():
        historical = existing.filter(pl.col("is_current") == False)  # noqa: E712
        if not historical.is_empty():
            parts.append(historical)

    # 2. Current rows that are unchanged: keep as-is
    unchanged_keys = common_keys - changed_keys
    if unchanged_keys and not current_rows.is_empty():
        unchanged = current_rows.filter(
            pl.col(entity_key_col).is_in(list(unchanged_keys))
        )
        if not unchanged.is_empty():
            parts.append(unchanged)

    # 3. Close out changed and deleted rows
    keys_to_close = changed_keys | deleted_keys
    if keys_to_close and not current_rows.is_empty():
        closed = current_rows.filter(
            pl.col(entity_key_col).is_in(list(keys_to_close))
        ).with_columns(
            pl.lit(close_date).alias("valid_to"),
            pl.lit(False).alias("is_current"),
        )
        if not closed.is_empty():
            parts.append(closed)

    # 4. New versions for changed entities + brand new entities
    keys_to_add = new_keys | changed_keys
    if keys_to_add:
        assert next_surrogate is not None
        new_rows = incoming.filter(
            pl.col(entity_key_col).is_in(list(keys_to_add))
        )
        # Add SCD2 columns
        surrogates = list(range(next_surrogate, next_surrogate + len(new_rows)))
        new_rows = new_rows.with_columns(
            pl.Series(name=surrogate_key_col, values=surrogates),
            pl.lit(change_date).alias("valid_from"),
            pl.lit(END_OF_TIME).alias("valid_to"),
            pl.lit(True).alias("is_current"),
        )
        # Ensure column order matches existing schema
        if not existing.is_empty():
            # Add any missing columns with null
            for col_name in existing.columns:
                if col_name not in new_rows.columns:
                    new_rows = new_rows.with_columns(
                        pl.lit(None).alias(col_name)
                    )
            new_rows = new_rows.select(existing.columns)
        parts.append(new_rows)

    if not parts:
        return existing

    result = pl.concat(parts, how="diagonal_relaxed")
    return result.sort(entity_key_col, "valid_from")


def _compute_hash(
    df: pl.DataFrame, logical_cols: list[str], hash_col: str
) -> pl.DataFrame:
    """Compute a record hash from the logical columns."""
    # Concatenate all logical columns as strings, then hash
    hash_expr = pl.concat_str(
        [pl.col(c).cast(pl.String).fill_null("__NULL__") for c in logical_cols],
        separator="|",
    ).hash()
    return df.with_columns(hash_expr.alias(hash_col))
