"""Smoke-test ingest: writes a hello Parquet to bronze."""

from datetime import UTC, datetime
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[4] / "data"


def run() -> Path:
    """Write a hello.parquet to data/bronze/hello/."""
    output_dir = DATA_DIR / "bronze" / "hello"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "hello.parquet"

    df = pl.DataFrame(
        {
            "message": ["hello"],
            "generated_at": [datetime.now(UTC)],
        }
    )
    df.write_parquet(output_path)
    print(f"Wrote {output_path}")
    return output_path


if __name__ == "__main__":
    run()
