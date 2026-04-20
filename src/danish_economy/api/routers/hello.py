"""Smoke-test route: GET /hello returns the latest hello message from bronze."""

from pathlib import Path

import duckdb
from fastapi import APIRouter
from pydantic import BaseModel

DATA_DIR = Path(__file__).resolve().parents[4] / "data"

router = APIRouter()


class HelloResponse(BaseModel):
    message: str
    generated_at: str


@router.get("/hello", response_model=HelloResponse)
def get_hello() -> HelloResponse:
    """Return the latest hello message from the bronze Parquet file."""
    parquet_path = DATA_DIR / "bronze" / "hello" / "hello.parquet"
    conn = duckdb.connect()
    row = conn.execute(
        f"SELECT message, generated_at::VARCHAR as generated_at "
        f"FROM read_parquet('{parquet_path}') "
        f"ORDER BY generated_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row is None:
        raise FileNotFoundError("No hello data found. Run the ETL first.")
    return HelloResponse(message=row[0], generated_at=row[1])
