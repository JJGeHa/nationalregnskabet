"""Full warehouse rebuild: bronze → silver → gold.

Usage: python -m danish_economy.etl.build
"""

from __future__ import annotations

import time

from danish_economy.etl.ingest.dst import ingest_table
from danish_economy.etl.ingest.finanslov import ingest_finanslov_range
from danish_economy.etl.transform.gold.dim_date import build_dim_date
from danish_economy.etl.transform.gold.dim_institution import build_dim_institution
from danish_economy.etl.transform.gold.dim_metric import build_dim_metric
from danish_economy.etl.transform.gold.dim_source import build_dim_source
from danish_economy.etl.transform.gold.mappings.dst_off3 import (
    build_fct_economic_metric,
)
from danish_economy.etl.transform.gold.mappings.finanslov import build_fct_finanslov
from danish_economy.etl.transform.silver.dst import transform_table
from danish_economy.etl.transform.silver.finanslov import transform_finanslov_range

FL_START = 2010
FL_END = 2026


def main() -> None:
    start = time.time()
    print("=== Building warehouse ===\n")

    # 1. Bronze: ingest all sources
    print("--- Bronze ---")
    ingest_table("OFF3", full=True)
    print()
    _ingest_dst_kommune_tables()
    print()
    ingest_finanslov_range(FL_START, FL_END)

    # 2. Silver: transform all sources
    print("\n--- Silver ---")
    transform_table("OFF3")
    _transform_dst_kommune_tables()
    transform_finanslov_range(FL_START, FL_END)

    # 3. Gold: dimensions (must come before facts)
    print("\n--- Gold: dimensions ---")
    build_dim_date()
    build_dim_metric()
    build_dim_source()
    build_dim_institution()

    # 4. Gold: facts (order matters — OFF3 first, then others append)
    print("\n--- Gold: facts ---")
    build_fct_economic_metric()
    build_fct_finanslov(start_year=FL_START, end_year=FL_END)
    _build_kommune_facts()

    elapsed = time.time() - start
    print(f"\n=== Warehouse built in {elapsed:.1f}s ===")


def _ingest_dst_kommune_tables() -> None:
    """Ingest DST tables for kommune data."""
    for table_id in ("PSKAT", "NGLK"):
        try:
            ingest_table(table_id, full=True)
        except Exception as e:
            print(f"Warning: failed to ingest {table_id}: {e}")


def _transform_dst_kommune_tables() -> None:
    """Transform DST kommune tables to silver."""
    for table_id in ("PSKAT", "NGLK"):
        try:
            transform_table(table_id)
        except Exception as e:
            print(f"Warning: failed to transform {table_id}: {e}")


def _build_kommune_facts() -> None:
    """Build kommune fact rows from silver data."""
    try:
        from danish_economy.etl.transform.gold.mappings.dst_pskat import (
            build_fct_pskat,
        )

        build_fct_pskat()
    except Exception as e:
        print(f"Warning: PSKAT facts failed: {e}")

    try:
        from danish_economy.etl.transform.gold.mappings.dst_nglk import (
            build_fct_nglk,
        )

        build_fct_nglk()
    except Exception as e:
        print(f"Warning: NGLK facts failed: {e}")


if __name__ == "__main__":
    main()
