"""Smoke tests for the hello pipeline."""

from pathlib import Path

from fastapi.testclient import TestClient

from danish_economy.api.main import app
from danish_economy.etl.ingest.hello import run as run_hello_ingest


def test_hello_ingest_writes_parquet(tmp_path: Path, monkeypatch: object) -> None:
    """Verify the hello ingest writes a valid Parquet file."""
    import danish_economy.etl.ingest.hello as hello_mod

    monkeypatch.setattr(hello_mod, "DATA_DIR", tmp_path)  # type: ignore[attr-defined]
    output = run_hello_ingest()
    assert output.exists()
    assert output.suffix == ".parquet"


def test_hello_endpoint_returns_message() -> None:
    """GET /hello returns the hello message after ETL runs."""
    # Ensure the parquet exists
    run_hello_ingest()
    client = TestClient(app)
    response = client.get("/hello")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "hello"
    assert "generated_at" in data
