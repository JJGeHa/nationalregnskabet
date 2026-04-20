"""Full warehouse rebuild: bronze → silver → gold.

Usage: python -m danish_economy.etl.build
"""

from __future__ import annotations

import time

from danish_economy.etl.ingest.dst import ingest_table
from danish_economy.etl.transform.gold.dim_date import build_dim_date
from danish_economy.etl.transform.gold.dim_institution import build_dim_institution
from danish_economy.etl.transform.gold.dim_metric import build_dim_metric
from danish_economy.etl.transform.gold.dim_source import build_dim_source
from danish_economy.etl.transform.gold.mappings.dst_off3 import (
    build_fct_economic_metric,
)
from danish_economy.etl.transform.silver.dst import transform_table


def main() -> None:
    start = time.time()
    print("=== Building warehouse ===\n")

    # 1. Bronze: ingest DST OFF3
    print("--- Bronze ---")
    ingest_table("OFF3", full=True)

    # 2. Silver: transform OFF3
    print("\n--- Silver ---")
    transform_table("OFF3")

    # 3. Gold: dimensions
    print("\n--- Gold: dimensions ---")
    build_dim_date()
    build_dim_metric()
    build_dim_source()
    build_dim_institution()

    # 4. Gold: facts
    print("\n--- Gold: facts ---")
    build_fct_economic_metric()

    elapsed = time.time() - start
    print(f"\n=== Warehouse built in {elapsed:.1f}s ===")


if __name__ == "__main__":
    main()
