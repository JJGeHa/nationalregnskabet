"""Build gold-layer Finanslov konto table with hovedkonto-level detail.

Aggregates silver FL data to hovedkonto level (one level below hovedområde)
so the API can serve deep drill-down views.

Hierarchy: paragraf → hovedområde → aktivitetsområde → hovedkonto
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[6] / "data"

FL_START = 2010
FL_END = 2026


def build_finanslov_konto(data_dir: Path | None = None) -> Path:
    """Read all silver FL files, aggregate to hovedkonto, write gold."""
    base = data_dir or DATA_DIR
    silver_dir = base / "silver" / "finanslov"
    gold_dir = base / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)

    frames: list[pl.DataFrame] = []
    for year in range(FL_START, FL_END + 1):
        yy = str(year)[-2:]
        path = silver_dir / f"fl{yy}.parquet"
        if not path.exists():
            continue
        df = pl.read_parquet(path)

        # Aggregate to hovedkonto level
        agg = (
            df.group_by(
                "paragraf_nr",
                "paragraf_name",
                "hovedomraade_nr",
                "hovedomraade_name",
                "aktivitet_nr",
                "hovedkonto_nr",
                "hovedkonto_name",
                "fiscal_year",
            )
            .agg(
                pl.col("finanslov").sum(),
                pl.col("regnskab_minus2").sum(),
            )
        )
        frames.append(agg)

    if not frames:
        msg = "No silver Finanslov files found"
        raise FileNotFoundError(msg)

    detail = pl.concat(frames).sort(
        "fiscal_year", "paragraf_nr", "hovedomraade_nr", "hovedkonto_nr"
    )

    out = gold_dir / "finanslov_konto.parquet"
    detail.write_parquet(out)
    print(f"finanslov_konto: {out} — {detail.shape[0]} rows")
    return out


if __name__ == "__main__":
    build_finanslov_konto()
