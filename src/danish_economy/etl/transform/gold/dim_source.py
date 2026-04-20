"""Build dim_source: one row per upstream data source."""

from __future__ import annotations

from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[5] / "data"


def build_dim_source(data_dir: Path | None = None) -> Path:
    """Generate dim_source.parquet in the gold layer."""
    base = data_dir or DATA_DIR
    gold_dir = base / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)

    df = pl.DataFrame(
        {
            "source_key": [1, 2, 3, 4],
            "source_code": ["dst", "dn", "finanslov", "opendata_dk"],
            "name_da": [
                "Danmarks Statistik",
                "Danmarks Nationalbank",
                "Finansministeriet (Finanslov)",
                "Open Data DK",
            ],
            "name_en": [
                "Statistics Denmark",
                "Danmarks Nationalbank",
                "Ministry of Finance (Budget)",
                "Open Data DK",
            ],
            "api_base_url": [
                "https://api.statbank.dk/v1",
                "https://api.nationalbanken.dk",
                None,
                "https://portal.opendata.dk",
            ],
        }
    )

    output_path = gold_dir / "dim_source.parquet"
    df.write_parquet(output_path)
    print(f"dim_source: {output_path} — {df.shape[0]} rows")
    return output_path


if __name__ == "__main__":
    build_dim_source()
