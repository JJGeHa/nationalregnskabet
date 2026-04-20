"""Silver transform for Finanslov CSV data.

Reads bronze FL CSV pairs (blb + txt), parses the 10-digit hierarchical
account codes, joins amounts with texts, and writes a clean silver Parquet.

Account code structure (10 digits):
  PP HH AA KK UU SS
  │  │  │  │  │  └─ standardkonto (digits 9-10)
  │  │  │  │  └──── underkonto    (digits 7-8)
  │  │  │  └─────── hovedkonto    (digits 5-6)
  │  │  └────────── aktivitetsomr (digit 4)
  │  └───────────── hovedomraade  (digit 3)
  └──────────────── paragraf      (digits 1-2)
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[5] / "data"

# Column names for the 6 value columns in FL blb.csv
# R(F-2), B(F-1), F, BO1, BO2, BO3
VALUE_COLUMNS = [
    "regnskab_minus2",  # Actual accounts, FY-2
    "bevilling_minus1",  # Appropriation, FY-1
    "finanslov",  # This year's Finanslov (the enacted budget)
    "budgetoverslag_1",  # Forward estimate +1
    "budgetoverslag_2",  # Forward estimate +2
    "budgetoverslag_3",  # Forward estimate +3
]


def _parse_blb(text: str) -> pl.DataFrame:
    """Parse a Finanslov amounts CSV into a DataFrame."""
    rows: list[dict[str, str | int]] = []
    reader = csv.reader(io.StringIO(text))
    for line in reader:
        if len(line) < 7:
            continue
        code = line[0].strip()
        values = [int(v) for v in line[1:7]]
        row: dict[str, str | int] = {"account_code": code}
        for col, val in zip(VALUE_COLUMNS, values):
            row[col] = val
        rows.append(row)
    return pl.DataFrame(rows)


def _parse_txt(text: str) -> dict[str, str]:
    """Parse a Finanslov texts CSV into a code→name lookup."""
    lookup: dict[str, str] = {}
    reader = csv.reader(io.StringIO(text))
    for line in reader:
        if len(line) < 2:
            continue
        code = line[0].strip()
        name = line[1].strip()
        lookup[code] = name
    return lookup


def _extract_hierarchy(code: str, txt_lookup: dict[str, str]) -> dict[str, str | None]:
    """Extract hierarchy levels and names from a 10-digit account code."""
    paragraf = code[:2]
    hovedomr = code[:3]
    aktivitet = code[:4]
    hovedkonto = code[:6]
    underkonto = code[:8]
    standardkonto = code[8:10]

    return {
        "paragraf_nr": paragraf,
        "paragraf_name": txt_lookup.get(f"{paragraf}00000000"),
        "hovedomraade_nr": hovedomr,
        "hovedomraade_name": txt_lookup.get(f"{hovedomr}0000000"),
        "aktivitet_nr": aktivitet,
        "hovedkonto_nr": hovedkonto,
        "hovedkonto_name": txt_lookup.get(f"{hovedkonto}0000"),
        "underkonto_nr": underkonto,
        "underkonto_name": txt_lookup.get(f"{underkonto}00"),
        "standardkonto_nr": standardkonto,
        "standardkonto_name": txt_lookup.get(f"00000000{standardkonto}"),
    }


def find_latest_bronze_run(fiscal_year: int, data_dir: Path | None = None) -> Path:
    """Find the latest bronze run directory for a given fiscal year."""
    base = data_dir or DATA_DIR
    yy = str(fiscal_year)[-2:]
    table_dir = base / "bronze" / "finanslov" / f"FL{yy}"
    if not table_dir.exists():
        msg = f"No bronze data for FL{yy} at {table_dir}"
        raise FileNotFoundError(msg)
    runs = sorted(table_dir.glob("run_date=*"))
    if not runs:
        msg = f"No runs found under {table_dir}"
        raise FileNotFoundError(msg)
    return runs[-1]


def transform_finanslov(
    fiscal_year: int,
    *,
    data_dir: Path | None = None,
) -> Path:
    """Transform a Finanslov bronze CSV pair into silver Parquet.

    Writes data/silver/finanslov/fl{YY}.parquet with columns:
      account_code, paragraf_nr, paragraf_name, hovedkonto_nr, hovedkonto_name,
      underkonto_nr, underkonto_name, standardkonto_nr, standardkonto_name,
      fiscal_year, regnskab_minus2, bevilling_minus1, finanslov, bo1, bo2, bo3
    """
    base = data_dir or DATA_DIR
    run_dir = find_latest_bronze_run(fiscal_year, data_dir=data_dir)

    blb_text = (run_dir / "blb.csv").read_text(encoding="utf-8")
    txt_text = (run_dir / "txt.csv").read_text(encoding="utf-8")

    blb_df = _parse_blb(blb_text)
    txt_lookup = _parse_txt(txt_text)

    # Enrich each row with hierarchy information
    enriched_rows: list[dict[str, str | int | float | None]] = []
    for row in blb_df.to_dicts():
        code = str(row["account_code"])
        hierarchy = _extract_hierarchy(code, txt_lookup)
        enriched: dict[str, str | int | float | None] = {
            "account_code": code,
            **hierarchy,
            "fiscal_year": fiscal_year,
        }
        for col in VALUE_COLUMNS:
            enriched[col] = row[col]
        enriched_rows.append(enriched)

    df = pl.DataFrame(enriched_rows)

    # Convert amounts from kr/ore to mio DKK
    for col in VALUE_COLUMNS:
        df = df.with_columns(
            (pl.col(col).cast(pl.Float64) / 1_000_000).alias(col)
        )

    # Write silver
    silver_dir = base / "silver" / "finanslov"
    silver_dir.mkdir(parents=True, exist_ok=True)
    yy = str(fiscal_year)[-2:]
    output_path = silver_dir / f"fl{yy}.parquet"
    df.write_parquet(output_path)
    print(
        f"Silver FL{fiscal_year}: {output_path} — {df.shape[0]} rows, "
        f"{df.shape[1]} columns"
    )
    return output_path


def transform_finanslov_range(
    start_year: int = 2010,
    end_year: int = 2024,
    *,
    data_dir: Path | None = None,
) -> list[Path]:
    """Transform all available Finanslov bronze data to silver."""
    paths = []
    for year in range(start_year, end_year + 1):
        try:
            path = transform_finanslov(year, data_dir=data_dir)
            paths.append(path)
        except FileNotFoundError:
            print(f"No bronze data for FL{year}, skipping")
    return paths
