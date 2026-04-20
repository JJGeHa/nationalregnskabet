"""DST StatBank ingester: fetches data and writes to bronze."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from danish_economy.etl.ingest.dst.client import DSTClient

DATA_DIR = Path(__file__).resolve().parents[5] / "data"


def ingest_table(
    table_id: str,
    *,
    full: bool = True,
    data_dir: Path | None = None,
) -> Path:
    """Fetch a DST table and write bronze artifacts.

    Writes:
      - data/bronze/dst/{TABLE}/run_date=YYYY-MM-DD/raw.json  (or raw.csv for BULK)
      - data/bronze/dst/{TABLE}/run_date=YYYY-MM-DD/metadata.json

    Returns the run directory path.
    """
    base = data_dir or DATA_DIR
    run_date = datetime.now(UTC).strftime("%Y-%m-%d")
    run_dir = base / "bronze" / "dst" / table_id / f"run_date={run_date}"
    run_dir.mkdir(parents=True, exist_ok=True)

    with DSTClient() as client:
        # 1. Fetch and save metadata
        meta = client.get_metadata(table_id)
        meta_path = run_dir / "metadata.json"
        meta_path.write_text(json.dumps(meta.raw, ensure_ascii=False, indent=2))
        print(f"Wrote {meta_path}")

        # 2. Fetch data
        # Use BULK format (semicolon CSV) — no cell limit issues
        variables: dict[str, list[str]] | None = None
        if full:
            variables = {v.id: ["*"] for v in meta.variables}

        raw_text = client.get_data(table_id, variables, fmt="BULK")
        raw_path = run_dir / "raw.csv"
        raw_path.write_text(raw_text, encoding="utf-8")
        print(f"Wrote {raw_path} ({len(raw_text)} bytes)")

    return run_dir
