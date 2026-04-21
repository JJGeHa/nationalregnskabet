"""DuckDB warehouse connection and schema registration."""

import threading
from pathlib import Path

import duckdb

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
GOLD_DIR = DATA_DIR / "gold"
WAREHOUSE_DB = DATA_DIR / "warehouse.duckdb"

# CREATE OR REPLACE VIEW races under concurrent FastAPI requests (two threads
# rewriting the same catalog entry). Serialize view registration so only one
# thread mutates the catalog at a time; subsequent connections see existing
# views via CREATE VIEW IF NOT EXISTS and skip the write.
_REGISTER_LOCK = threading.Lock()


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a DuckDB connection with gold Parquet files registered as views."""
    conn = duckdb.connect(str(WAREHOUSE_DB))
    with _REGISTER_LOCK:
        _register_gold_views(conn)
        _register_convenience_views(conn)
    return conn


def _register_gold_views(conn: duckdb.DuckDBPyConnection) -> None:
    """Register each gold-layer Parquet file as a view."""
    if not GOLD_DIR.exists():
        return
    for parquet_file in GOLD_DIR.glob("*.parquet"):
        view_name = parquet_file.stem
        conn.execute(
            f"CREATE VIEW IF NOT EXISTS {view_name} "
            f"AS SELECT * FROM read_parquet('{parquet_file}')"
        )


def _register_convenience_views(conn: duckdb.DuckDBPyConnection) -> None:
    """Register pre-joined convenience views."""
    conn.execute("""
        CREATE VIEW IF NOT EXISTS v_metric_timeseries AS
        SELECT
            d.date,
            d.year,
            d.quarter,
            d.month,
            i.entity_key,
            i.name_da AS institution_da,
            i.name_en AS institution_en,
            i.inst_type,
            m.metric_code,
            m.name_da AS metric_da,
            m.name_en AS metric_en,
            m.unit,
            m.category AS metric_category,
            s.source_code,
            s.name_en AS source_name,
            f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        JOIN dim_source s ON f.source_key = s.source_key
    """)
