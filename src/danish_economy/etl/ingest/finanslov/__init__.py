"""Finanslov ingester: downloads CSV files from oes-cs.dk.

The Danish Finanslov (state budget) is published as CSV files at
https://www.oes-cs.dk/bevillingslove/. Two files per fiscal year:
  - fl{YY}blb.csv — amounts (10-digit account code + 6 value columns)
  - fl{YY}txt.csv — account hierarchy texts (10-digit code + Danish name)

Encoding: ISO-8859-1 (Latin-1).
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
BASE_URL = "https://www.oes-cs.dk/bevillingslove"
TIMEOUT = 30.0


def ingest_finanslov(
    fiscal_year: int,
    *,
    data_dir: Path | None = None,
) -> Path:
    """Download Finanslov CSV pair for a fiscal year.

    Writes:
      data/bronze/finanslov/FL{YY}/run_date=YYYY-MM-DD/blb.csv
      data/bronze/finanslov/FL{YY}/run_date=YYYY-MM-DD/txt.csv

    Returns the run directory path.
    """
    base = data_dir or DATA_DIR
    yy = str(fiscal_year)[-2:]
    run_date = datetime.now(UTC).strftime("%Y-%m-%d")
    run_dir = base / "bronze" / "finanslov" / f"FL{yy}" / f"run_date={run_date}"
    run_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=TIMEOUT) as client:
        for suffix in ("blb", "txt"):
            url = f"{BASE_URL}/fl{yy}{suffix}.csv"
            resp = client.get(url)
            resp.raise_for_status()
            # Decode from Latin-1 and re-encode as UTF-8
            content = resp.content.decode("iso-8859-1")
            out_path = run_dir / f"{suffix}.csv"
            out_path.write_text(content, encoding="utf-8")
            print(f"Wrote {out_path} ({len(content)} bytes)")

    return run_dir


def ingest_finanslov_range(
    start_year: int = 2010,
    end_year: int = 2024,
    *,
    data_dir: Path | None = None,
) -> list[Path]:
    """Download Finanslov CSVs for a range of fiscal years."""
    paths = []
    for year in range(start_year, end_year + 1):
        try:
            path = ingest_finanslov(year, data_dir=data_dir)
            paths.append(path)
        except httpx.HTTPStatusError as e:
            print(f"Skipping FL{year}: {e}")
    return paths


if __name__ == "__main__":
    ingest_finanslov_range()
