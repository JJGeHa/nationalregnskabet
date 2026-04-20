# Danish Public Economy Explorer — Kickoff Package

This document contains two things:

1. **`CLAUDE.md`** — the project-context file. Place this at the repo root as `CLAUDE.md`. Claude Code reads it automatically when run in that directory.
2. **Four kickoff prompts** — sequential tasks. Paste each one (in order) into a fresh Claude Code session when you're ready to execute it. They build on each other.

---

# Part 1 — `CLAUDE.md`

*Save the section below as `CLAUDE.md` at your repo root.*

```markdown
# Danish Public Economy Explorer

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
```

---

# Part 2 — Kickoff prompts

Each prompt below is a standalone Claude Code session. Run them in order. Each
one ends with explicit acceptance criteria and check-in points.

---

## Prompt 01 — Bootstrap the repository

```markdown
# Task: Bootstrap the repository

## Context
Read CLAUDE.md first. This task is scaffolding only — no domain logic yet. The
goal is a clean end-to-end pipe that proves the stack works together, so every
later prompt can assume a working foundation.

## Goal
After this task, `docker compose up` from a fresh checkout should bring the
whole stack up green, and `http://localhost:3000` should render a value
retrieved end-to-end: ETL writes a Parquet → DuckDB reads it → FastAPI serves
it → Next.js fetches and displays it.

## Scope
1. Create the directory structure exactly as in CLAUDE.md.
2. Python project with `uv`, `pyproject.toml` declaring: `fastapi`, `uvicorn`,
   `duckdb`, `polars`, `httpx`, `pydantic`, `pytest`, `pytest-asyncio`, `ruff`,
   `black`, `mypy`.
3. Next.js 15 project in `web/` with TypeScript strict mode, Tailwind, and
   **Biome** for linting + formatting (single tool, single config).
4. `docker-compose.yml` with three services sharing a volume on `data/`:
   - `api`: `uvicorn src.danish_economy.api.main:app --reload --host 0.0.0.0`
   - `web`: `pnpm dev`
   - `etl`: one-shot, runs the smoke-test ingest then exits.
5. `.github/workflows/ci.yml` — on push: ruff, black --check, mypy, pytest;
   for web: `pnpm lint` and `pnpm build`.
6. Smoke-test implementation:
   - `src/danish_economy/etl/ingest/hello.py` writes
     `data/bronze/hello/hello.parquet` with `{"message": "hello", "generated_at": <now>}`.
   - `src/danish_economy/api/routers/hello.py` — `GET /hello` returns the
     latest row from that Parquet via DuckDB.
   - `web/app/page.tsx` — server component that fetches `/hello` and renders
     the message.
7. `README.md` with a quickstart: clone → `docker compose up` → open
   localhost:3000.
8. `.gitignore` covering: `.env*`, `data/warehouse.duckdb`, `data/bronze/`,
   `data/silver/`, `data/gold/`, `node_modules/`, `.venv/`, `__pycache__/`,
   `.next/`, `.DS_Store`.
9. `.env.example` (empty for now, but present).
10. `docs/decisions/001-warehouse-choice.md` — one-paragraph ADR on choosing
    DuckDB over Postgres/MongoDB. Frame it around workload shape (analytical,
    read-heavy, single-writer ETL), why columnar storage matters for this
    access pattern, operational simplicity (file-based, Parquet-native), and
    what we'd reach for differently if the workload became concurrent-write
    or multi-user. This is the repo's first piece of written architectural
    reasoning — set the tone.

## Acceptance
- `docker compose up` brings the stack up cleanly from a fresh checkout.
- Visiting http://localhost:3000 renders "hello" retrieved end-to-end.
- `docker compose run --rm api pytest` passes.
- CI workflow runs green on first push.

## Check in with me
- After drafting the folder tree — confirm before creating files.
- After drafting the warehouse-choice ADR — show me the draft before
  finalising it. It's the first piece of architectural writing in the repo
  and the tone-setter for everything after.
- Before marking complete — run the full smoke test and report the output.

## Do not
- Add any domain logic (no DST, no dim tables, no real metrics).
- Pull in dependencies beyond what's listed without justification.
- Commit generated Parquet files — the smoke test should produce them at runtime.
```

---

## Prompt 02 — DST StatBank ingester (bronze + silver)

```markdown
# Task: DST ingester — bronze + silver for table OFF3

## Context
Read CLAUDE.md. Prompt 01 must be complete and green.

This task builds the first real ingest pipeline. We hit Danmarks Statistik's
StatBank API, land raw responses in bronze, and produce a cleaned silver
Parquet. We start with **OFF3** ("Den offentlige sektors udgifter og indtægter")
because it's a clean public-sector aggregate and a good stress test of the
pipeline shape.

No gold mapping yet — that's the next prompt. Do one source well first.

## Goal
Running `python -m danish_economy.etl.ingest.dst --table OFF3` should produce:
- `data/bronze/dst/OFF3/run_date=YYYY-MM-DD/raw.json` — the untouched API body.
- `data/bronze/dst/OFF3/run_date=YYYY-MM-DD/metadata.json` — the metadata response.
- `data/silver/dst/off3.parquet` — cleaned, typed, English column names,
  overwritten on each run.

## Scope
1. Generic DST client at `src/danish_economy/etl/ingest/dst/client.py`:
   - `class DSTClient` with `get_metadata(table_id)` and `get_data(table_id, variables: dict)`.
   - `httpx`-based, with timeouts, exponential backoff, polite User-Agent.
   - Respects DST's 1,000,000-cell limit on non-bulk endpoints — if a requested
     query exceeds it, fall through to the bulk endpoint (streams in chunks).
   - No auth required for public tables.
   - Returns pydantic-modelled responses where structure is stable; raw dicts
     otherwise.
2. Pipeline at `src/danish_economy/etl/ingest/dst/__init__.py`:
   - CLI: `python -m danish_economy.etl.ingest.dst --table OFF3 [--full]`
   - Fetches metadata, then data. `--full` = all variables = `*`.
   - Writes bronze partitioned by `run_date=YYYY-MM-DD`.
3. Silver transform at `src/danish_economy/etl/transform/silver/dst.py`:
   - Reads the latest bronze run for a given table.
   - Uses metadata to drive column renaming to English
     (`Tid` → `date`, `OMRÅDE` → `area`, etc.).
   - Parses `Tid` into proper `DATE` type (DST uses `2024`, `2024K1`, `2024M03` —
     handle all three).
   - Writes `data/silver/dst/off3.parquet`.
4. Tests:
   - Client: mocked HTTP; verify retry, backoff, and bulk-fallback behaviour.
   - Silver: snapshot test against a small recorded bronze fixture.
5. Documentation:
   - `docs/data-model.md` — start the "Sources" section. Describe what OFF3
     contains, link to the DST docs page, note any gotchas you discovered
     (e.g. some values come as strings with commas; `..` means missing).
6. `docs/decisions/002-bronze-retention.md` — decide: keep every bronze run
   forever, or rotate after N runs? Document the choice and why.

## Acceptance
- CLI against real DST produces valid bronze + silver artifacts.
- Silver Parquet: English columns, correct types, no duplicate rows, dates
  parsed as `DATE`.
- All tests pass, lint clean.

## Check in with me
- After sketching the `DSTClient` interface — before writing retry/bulk logic.
- After the first successful real API call — show a sample of raw JSON before
  transforming.
- After silver is written — show the schema and row count.

## Do not
- Start any gold-layer mapping.
- Bake OFF3-specific logic into the generic client — keep the client reusable.
- Skip the bronze layer even though it feels redundant. The discipline matters
  for reproducibility.
```

---

## Prompt 03 — `dim_institution` with SCD Type 2

```markdown
# Task: dim_institution with SCD Type 2 and seed data

## Context
Read CLAUDE.md. Especially the "Modeling rules" section and the column list for
`dim_institution`. Prompts 01–02 must be complete.

`dim_institution` is the single most important table in the warehouse. Every
fact joins to it; the AI layer reasons over it; the frontend filters on it.
We seed it from hand-curated YAML + DST's official kommune/region register
because the hierarchy is not published as one tidy machine-readable source.

## Goal
Produce `data/gold/dim_institution.parquet` as an SCD Type 2 table, populated
from a YAML seed + official registers.

## Scope
1. Schema — exactly the columns listed in CLAUDE.md. Notable:
   - `inst_key` (surrogate, BIGINT, unique per row).
   - `entity_key` (business key, stable across versions).
   - Classification: `inst_type`, `inst_subtype`, `sector_esa2010`,
     `is_general_government`.
   - Hierarchy: `parent_entity_key`, `hierarchy_path`, `hierarchy_depth`.
   - Geography columns (nullable for non-geographic units).
   - SCD2: `valid_from`, `valid_to` (default `9999-12-31`), `is_current`.
   - Audit: `source_system`, `loaded_at`, `record_hash`.
2. Seed YAML at `src/danish_economy/etl/seeds/dim_institution.yaml`:
   - `STAT` (1 row).
   - All current ministerier (~20, hand-curated).
   - Major styrelser under each ministerium (~50, hand-curated; enough to
     demonstrate the hierarchy).
   - All 98 kommuner — auto-generated from DST's `KOMKODER` register; do not
     hand-type these.
   - All 5 regioner.
   - Optional but nice-to-have: folkekirken, ATP, LD, major selvejende
     institutioner.
3. Loader at `src/danish_economy/etl/transform/gold/dim_institution.py`:
   - Reads the YAML + the kommune/region data from DST (you'll need the
     ingester from prompt 02 for the register).
   - Computes `hierarchy_path` and `hierarchy_depth` from parent pointers.
   - Computes `record_hash` over logical fields.
   - Initial load: `valid_from = 2025-01-01`, `valid_to = 9999-12-31`,
     `is_current = true`.
4. Generic SCD2 merge utility at
   `src/danish_economy/etl/transform/gold/scd2.py`:
   - Given (existing_df, new_df, logical_cols, change_date) → returns a new
     dataframe with old rows closed out and new versions appended.
   - Reusable for any future SCD2 dimension.
5. Tests:
   - SCD2 merge: simulate a styrelse moving from ministerium A to B. Verify the
     old row closes (`valid_to = change_date - 1 day`) and the new row opens
     (`valid_from = change_date`, `is_current = true`), and that both share
     the same `entity_key` but have different `inst_key`s.
   - Also: new entity (appended), unchanged entity (no-op), deleted entity
     (closed-out, not deleted).
6. Documentation:
   - Update `docs/data-model.md` with `dim_institution`: full column semantics,
     SCD2 worked example, how to query for "the parent ministerium of X as of
     date D".
   - `docs/decisions/003-institution-seed-strategy.md` — why hand-curation for
     ministerier + styrelser, registers for kommuner/regioner.

## Acceptance
Run these checks programmatically as part of tests:
- Unique `inst_key`.
- For every `entity_key`, `valid_from`/`valid_to` ranges don't overlap.
- Every non-root row's `parent_entity_key` resolves to an existing
  `entity_key` (referential integrity on business keys).
- `hierarchy_path` matches the chain of `parent_entity_key`s.
- `is_current = true` iff `valid_to = 9999-12-31`.

## Check in with me
- After drafting the YAML structure — show me 5 sample entries before
  populating the full file.
- After writing the SCD2 merge utility — walk me through the reorganisation
  test case.
- Before declaring complete — run a query that prints the full hierarchy under
  Klimaministeriet (or whichever ministerium you choose), with styrelser listed
  beneath. Paste the output.

## Do not
- Invent institutions you're unsure about. If unclear whether something is a
  styrelse or a selvejende institution, leave it out and flag it to me.
- Hand-type 98 kommuner — use the register.
- Skip `record_hash` — it's how future incremental updates detect change.
```

---

## Prompt 04 — First gold slice: OFF3 → `fct_economic_metric` → API → chart

```markdown
# Task: First end-to-end gold slice

## Context
Read CLAUDE.md. Prompts 01–03 must be complete: scaffolding works, OFF3 lands
in silver, `dim_institution` is populated.

This task proves the whole pipe: silver → gold mapping → warehouse → FastAPI →
Next.js chart. After this, every new source plugs in by repeating the
silver→gold step.

## Goal
A page at `http://localhost:3000/overview` rendering a line chart of Danish
public-sector net expenditure over time, fed entirely from the warehouse.

## Scope
1. **`dim_date`** at `src/danish_economy/etl/transform/gold/dim_date.py`:
   - Daily grain from 1990-01-01 to 2050-12-31.
   - Columns: `date_key` (INTEGER, YYYYMMDD), `date` (DATE), `year`,
     `quarter`, `month`, `month_name_da`, `month_name_en`, `day`, `iso_week`,
     `is_weekend`, `fiscal_year_dk`.
2. **`dim_metric`** at `src/danish_economy/etl/transform/gold/dim_metric.py`:
   - Seeded from `src/danish_economy/etl/seeds/dim_metric.yaml`.
   - Columns: `metric_key`, `metric_code` (e.g. `public_net_expenditure`),
     `name_da`, `name_en`, `unit` (`DKK`, `DKK_per_capita`, `pct_of_gdp`,
     `pct`), `category`, `subcategory`, `source_system`, `source_identifier`
     (the DST table+variable this came from, for lineage).
3. **`dim_source`**: trivial. One row per upstream source.
4. **Gold mapping for OFF3** at
   `src/danish_economy/etl/transform/gold/mappings/dst_off3.py`:
   - Reads silver `off3.parquet`.
   - Resolves `inst_key` via **date-aware lookup** against `dim_institution`
     (the row whose `valid_from <= date <= valid_to` wins).
   - Resolves `metric_key` via `dim_metric` (you'll need to define at least
     one metric code, e.g. `public_net_expenditure`, that maps to the
     appropriate OFF3 dimension value).
   - Resolves `date_key` and `source_key`.
   - Writes `data/gold/fct_economic_metric.parquet`.
5. **Warehouse module** at `src/danish_economy/warehouse/__init__.py`:
   - `get_connection()` returns a DuckDB connection with all gold Parquet files
     registered as views (`CREATE VIEW fct_economic_metric AS SELECT * FROM read_parquet(...)`).
   - Also registers a convenience view `v_metric_timeseries` that pre-joins
     the fact to its dimensions.
6. **API** at `src/danish_economy/api/routers/timeseries.py`:
   - `GET /timeseries?metric=public_net_expenditure&entity=STAT&from=2010-01-01&to=2025-01-01`
   - Returns `[{date, value, unit}, ...]`.
   - Pydantic response model; 404 on unknown metric or entity; 422 on bad dates.
7. **Frontend** at `web/app/overview/page.tsx`:
   - Server component that fetches the timeseries.
   - Renders with Observable Plot as a clean line chart.
   - Title, axis labels, source attribution ("Kilde: Danmarks Statistik, OFF3").
   - Mobile-responsive.
8. **Tests**:
   - Gold mapping: fixture-driven, verifies date-aware lookup picks the right
     `inst_key` when an institution has multiple SCD2 versions.
   - API: happy path + error cases.
   - Frontend: Playwright smoke test that the page renders and fetches data.
9. **Build script**: `make build-warehouse` (or a Python CLI) that runs the
   whole sequence from bronze → silver → gold for a clean rebuild.
10. `docs/decisions/004-metric-taxonomy.md` — how metrics are named,
    categorised, and referenced. This decision has long-term consequences.

## Acceptance
- `/overview` renders a correctly-shaped line chart from real DST data.
- Any chart data point traces back to the bronze JSON (verify manually for one
  year).
- Full clean rebuild (`make build-warehouse`) finishes in under 5 minutes.
- All tests pass, lint clean, CI green.

## Check in with me
- After sketching the `dim_metric` taxonomy — show me the first 5–10 metric
  codes before populating.
- After the first successful `/timeseries` response from the real warehouse —
  paste the JSON before building the chart.
- With a screenshot of the final chart.

## Do not
- Let the API or frontend query silver directly — gold only.
- Hardcode the metric list in code — it lives in `dim_metric`, seeded from YAML.
- Build more than the one chart. Subsequent prompts will add coverage.
```

---

# What comes after these four

Once prompts 01–04 are complete, the project has a working vertical slice. The
prompts that follow slot naturally into the same pattern:

- **05** — Nationalbanken ingester + gold mapping (second source plugged in).
- **06** — Finanslov ingester (hierarchical data; trickier silver transform).
- **07** — Kommune compare page + `fct_institutional_transfer` for flows.
- **08** — Open Data DK ingester + Choropleth map.
- **09** — AI layer v1: RAG over `dim_metric` + `dim_institution` metadata for
  natural-language → structured query.
- **10** — AI layer v2: grounded chart narration (inject the chart's data into
  the prompt; never let the model invent numbers).
- **11** — AI layer v3: anomaly detection (statsmodels seasonal decomposition +
  rolling z-score) with LLM-generated hypotheses labelled as such.
- **12** — DevOps: GitHub Actions cron for scheduled ETL; migration path to VPS.

I'll draft each of those as you finish the previous block. The prompts work
best when written against a repo state you've just seen work.
