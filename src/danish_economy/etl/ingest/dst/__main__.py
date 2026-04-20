"""CLI entrypoint: python -m danish_economy.etl.ingest.dst --table OFF3"""

from __future__ import annotations

import argparse

from danish_economy.etl.ingest.dst import ingest_table
from danish_economy.etl.transform.silver.dst import transform_table


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a DST StatBank table")
    parser.add_argument("--table", required=True, help="DST table ID (e.g. OFF3)")
    parser.add_argument(
        "--full", action="store_true", default=True, help="Fetch all variables"
    )
    parser.add_argument(
        "--skip-silver",
        action="store_true",
        help="Skip the silver transform step",
    )
    args = parser.parse_args()

    print(f"Ingesting DST table {args.table}...")
    run_dir = ingest_table(args.table, full=args.full)
    print(f"Bronze written to {run_dir}")

    if not args.skip_silver:
        print("Transforming to silver...")
        silver_path = transform_table(args.table)
        print(f"Silver written to {silver_path}")


if __name__ == "__main__":
    main()
