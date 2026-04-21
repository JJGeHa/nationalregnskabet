"""Transform PDF-sourced Finanslov overview into silver Parquet.

Creates a silver file compatible with the CSV-sourced pipeline but at
paragraph level only (no sub-paragraph breakdown available from PDFs).

Each paragraf gets a single synthetic row with the overview totals.
"""

from __future__ import annotations

import json
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[5] / "data"

# Reuse paragraf names from the PDF ingester
from danish_economy.etl.ingest.finanslov.pdf_overview import PARAGRAF_NAMES


def transform_finanslov_pdf(
    fiscal_year: int,
    *,
    data_dir: Path | None = None,
) -> Path:
    """Read parsed PDF overview JSON and write silver Parquet."""
    base = data_dir or DATA_DIR
    bronze_dir = base / "bronze" / "finanslov"
    silver_dir = base / "silver" / "finanslov"
    silver_dir.mkdir(parents=True, exist_ok=True)

    yy = str(fiscal_year)[-2:]

    # Find the latest run directory
    fl_dir = bronze_dir / f"FL{yy}"
    if not fl_dir.exists():
        msg = f"No bronze data for FL{yy}"
        raise FileNotFoundError(msg)

    run_dirs = sorted(fl_dir.glob("run_date=*"))
    if not run_dirs:
        msg = f"No run directories in {fl_dir}"
        raise FileNotFoundError(msg)

    latest = run_dirs[-1]
    json_path = latest / "overview_parsed.json"
    if not json_path.exists():
        msg = f"No parsed overview in {latest}"
        raise FileNotFoundError(msg)

    with open(json_path) as f:
        data = json.load(f)

    rows = []
    for par in data["paragraphs"]:
        par_nr = par["paragraf_nr"]
        par_name = PARAGRAF_NAMES.get(par_nr, f"Paragraf {par_nr}")

        # Create a synthetic hovedomraade code: {par_nr}0
        ho_nr = f"{par_nr}0"

        rows.append(
            {
                "account_code": f"{par_nr}00000000",
                "paragraf_nr": par_nr,
                "paragraf_name": par_name,
                "hovedomraade_nr": ho_nr,
                "hovedomraade_name": par_name,
                "aktivitet_nr": "",
                "hovedkonto_nr": "",
                "hovedkonto_name": "",
                "underkonto_nr": "",
                "underkonto_name": "",
                "standardkonto_nr": "",
                "standardkonto_name": "",
                "fiscal_year": fiscal_year,
                "regnskab_minus2": 0.0,
                "bevilling_minus1": 0.0,
                "finanslov": par["finanslov"],
                "budgetoverslag_1": 0.0,
                "budgetoverslag_2": 0.0,
                "budgetoverslag_3": 0.0,
            }
        )

    df = pl.DataFrame(
        rows,
        schema={
            "account_code": pl.String,
            "paragraf_nr": pl.String,
            "paragraf_name": pl.String,
            "hovedomraade_nr": pl.String,
            "hovedomraade_name": pl.String,
            "aktivitet_nr": pl.String,
            "hovedkonto_nr": pl.String,
            "hovedkonto_name": pl.String,
            "underkonto_nr": pl.String,
            "underkonto_name": pl.String,
            "standardkonto_nr": pl.String,
            "standardkonto_name": pl.String,
            "fiscal_year": pl.Int64,
            "regnskab_minus2": pl.Float64,
            "bevilling_minus1": pl.Float64,
            "finanslov": pl.Float64,
            "budgetoverslag_1": pl.Float64,
            "budgetoverslag_2": pl.Float64,
            "budgetoverslag_3": pl.Float64,
        },
    )

    out = silver_dir / f"fl{yy}.parquet"
    df.write_parquet(out)
    print(f"Silver FL{yy} (from PDF): {out} — {df.shape[0]} rows")
    return out


if __name__ == "__main__":
    for year in (2025, 2026):
        try:
            transform_finanslov_pdf(year)
        except FileNotFoundError as e:
            print(f"Skipping FL{year}: {e}")
