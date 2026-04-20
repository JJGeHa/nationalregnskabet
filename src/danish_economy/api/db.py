"""DuckDB dependency for FastAPI routes."""

from pathlib import Path

import duckdb

DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def get_db() -> duckdb.DuckDBPyConnection:
    """Return a DuckDB connection for request-scoped use."""
    conn = duckdb.connect(str(DATA_DIR / "warehouse.duckdb"))
    return conn
