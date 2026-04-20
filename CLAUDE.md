# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project mission

A web application that visualizes and analyzes Danish public-sector finances by
unifying data from:

- **Danmarks Statistik (DST)** — national accounts, public-sector aggregates, kommune/region budgets.
- **Danmarks Nationalbank (DN)** — financial statistics, government debt, interest.
- **Finansministeriet** — the finanslov (annual state budget), by ministerium and styrelse.
- **Open Data DK** — supplementary kommune-level datasets.

Three flagship capabilities:

1. **Consolidated view** — the full Danish public sector at any level, from state
   budget down to individual kommuner, with inter-level flows (bloktilskud etc.)
   visible and not double-counted.
2. **Institutional drill-down** — traceable hierarchy from stat → ministerier →
   styrelser, with regioner and kommuner as peer entities. History-aware: a
   styrelse moving between ministerier is modelled correctly (SCD Type 2).
3. **AI interface** — natural-language queries translated into structured
   warehouse queries (RAG over warehouse metadata); grounded narration on every
   chart; anomaly detection with LLM-generated hypotheses.

Audience: technical recruiters AND Danish journalists/citizens. Both matter.
Code readability, architectural clarity, and written documentation are
first-class deliverables, not afterthoughts.

## Architecture at a glance

Medallion pattern over a star schema with SCD Type 2 on slowly-changing dimensions.

```
     APIs (DST, DN, Finanslov, Open Data DK)
                       │
                       ▼
              ┌────────────────┐
              │   BRONZE       │  raw API responses, JSON/XML
              │   data/bronze/ │  append-only, date-partitioned
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │   SILVER       │  per-source cleaned Parquet,
              │   data/silver/ │  typed, English column names
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │   GOLD         │  unified star schema
              │   data/gold/   │  fct_* + dim_* Parquet files
              └────────┬───────┘
                       │
                       ▼
                  DuckDB reads gold Parquet
                       │
              ┌────────┴────────┐
              ▼                 ▼
         FastAPI             AI layer
              │                 │
              └────────┬────────┘
                       ▼
                   Next.js
```

### Star schema (gold layer)

One central fact table, several dimension tables.

- `fct_economic_metric` — the main fact: (date, institution, metric, source, value).
- `fct_institutional_transfer` — separate fact for inter-institution flows
  (bloktilskud, refusioner). Lets us show Sankey-style money-flow views without
  double-counting consolidated expenditure.
- `dim_institution` — SCD Type 2. Models stat / ministerium / styrelse /
  kommune / region hierarchy.
- `dim_date` — standard date dimension.
- `dim_metric` — taxonomy of measurements.
- `dim_source` — which upstream source a fact came from.

### Modeling rules (non-negotiable)

1. **Facts reference dimensions by surrogate key** (e.g. `inst_key`). One fact,
   one dimension row, clean join.
2. **Dimensions reference each other by business key** (e.g.
   `parent_entity_key`). Logical links, not version-specific.
3. **SCD Type 2 on `dim_institution`**: new rows, not overwrites. Every row has
   `valid_from`, `valid_to` (9999-12-31 for currently valid), and a stable
   `entity_key` shared across versions.
4. **Bronze is immutable and source-faithful.** Don't clean bronze — that's
   silver's job.
5. **Silver is per-source and domain-naïve.** It doesn't know about other
   sources or the unified model.
6. **Gold is the only layer the API and frontend read from.** No querying silver
   from the app.

## Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Warehouse | **DuckDB** over Parquet | Columnar, file-based, right tool for analytical workload |
| ETL | **Python 3.12** + `httpx`, `polars`, `duckdb` | Polars preferred; pandas where ergonomics win |
| API | **FastAPI** + Pydantic v2 | Async, OpenAPI out of the box |
| Frontend | **Next.js 15** App Router + TypeScript (strict) + TailwindCSS | |
| Charts | **Observable Plot** (default), **D3** when needed | |
| Maps | **MapLibre GL** + GeoJSON of Danish kommuner | Open alternative to Mapbox |
| AI | **Anthropic API** (Claude) for NL→query + narration; **statsmodels**/**scikit-learn** for anomalies | |
| Orchestration | **GitHub Actions** (cron for ETL, push for CI) | |
| Deployment | **Local Docker Compose** now; self-hosted VPS later | |
| Dep mgmt | **uv** (Python), **pnpm** (Node) | |
| Lint/format | **ruff** + **black** + **mypy** (Python); **Biome** for TS (lint + format, single tool) | |

## Repository layout

```
danish-economy/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── pyproject.toml
├── .github/workflows/
│   ├── ci.yml
│   └── etl.yml
├── src/danish_economy/
│   ├── api/
│   │   ├── main.py
│   │   ├── routers/
│   │   ├── db.py
│   │   └── schemas/
│   ├── etl/
│   │   ├── ingest/        # bronze writers per source
│   │   ├── transform/
│   │   │   ├── silver/    # per-source cleaning
│   │   │   └── gold/      # unified model mappings
│   │   └── seeds/         # hand-curated reference data
│   ├── warehouse/         # DuckDB connection, schema
│   └── common/
├── web/                   # Next.js (separate package)
├── data/
│   ├── bronze/
│   ├── silver/
│   ├── gold/
│   └── warehouse.duckdb   # gitignored, derived
├── tests/
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   └── decisions/         # ADRs
└── prompts/
```

## Commands

```bash
# Python dependencies (uv)
uv sync

# Node dependencies (web/)
cd web && pnpm install

# Run full stack
docker compose up

# Run API only
uvicorn src.danish_economy.api.main:app --reload --host 0.0.0.0

# Run frontend only
cd web && pnpm dev

# Python tests
pytest                      # all tests
pytest tests/path/test_x.py # single file
pytest -k "test_name"       # single test by name

# Linting & formatting (Python)
ruff check .
black --check .
mypy src/

# Linting & formatting (TypeScript)
cd web && pnpm lint          # Biome

# ETL — example: ingest DST table
python -m danish_economy.etl.ingest.dst --table OFF3

# Rebuild warehouse from scratch
make build-warehouse
```

## Conventions

**Python.** `snake_case`. Type hints required on public functions. Ruff +
black + mypy enforced in CI. Module docstrings always. Tests mirror source tree.

**SQL.** Lowercase keywords. CTEs over subqueries. `snake_case` columns.
`dim_*` / `fct_*` prefixes. No `SELECT *` in production code. `DATE` type for
dates, never strings.

**TypeScript.** Strict mode on. Function components. Tailwind utilities over
custom CSS. Colocate types.

**Commits.** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`). Small and atomic. Repo stays working at every commit.

## Non-goals for v1

Don't build these, even if tempted:

- User accounts / authentication.
- Real-time streaming / webhooks.
- Airflow / Prefect / Dagster — GitHub Actions cron is sufficient at this scale.
- Kubernetes / Terraform — Docker Compose is enough.
- MongoDB / any NoSQL — actively wrong for this workload.
- Custom ML model training — use pretrained; classical stats for anomalies.
- Full i18n framework. Danish + English labels on dims is fine.

## How to work on this project

Every Claude Code session, before writing code:

1. **Read this CLAUDE.md fully.** If a task seems to contradict it, flag the
   conflict rather than silently diverging.
2. **Propose a plan before writing code.** List files you'll create/modify and
   what each will contain. Wait for confirmation.
3. **Ask clarifying questions** when requirements are ambiguous — don't guess.
4. **Write tests alongside new modules.** Minimum: one happy-path test per
   public function.
5. **Commit atomically** with a Conventional Commits message.
6. **Write ADRs** in `docs/decisions/` for architectural choices. "We chose X
   over Y because Z" in under a page is fine.
7. **Never commit secrets.** `.env.local` + `.env.example`; read from
   environment.
8. **Stop and check in at natural boundaries** — after scaffolding, after the
   first end-to-end pipe, after each module passes tests. Don't power through
   multiple phases without feedback.
