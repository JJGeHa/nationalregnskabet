# Danish Public Economy Explorer

A web application that visualizes and analyzes Danish public-sector finances,
unifying data from Danmarks Statistik, Nationalbanken, Finansministeriet, and
Open Data DK.

## Quickstart

```bash
git clone <repo-url>
cd danish-economy
docker compose up
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

The ETL service runs automatically on startup, populating the data layer.
The API is available at [http://localhost:8000](http://localhost:8000).

## Development (without Docker)

### Python (API + ETL)

```bash
# Install uv if you haven't already
pip install uv

# Install dependencies
uv sync --all-extras

# Run ETL smoke test
python -m danish_economy.etl.ingest.hello

# Start the API
uvicorn danish_economy.api.main:app --reload

# Run tests
pytest

# Lint
ruff check src/ tests/
black --check src/ tests/
mypy src/
```

### Frontend

```bash
cd web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).
