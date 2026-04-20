# Data Model

## Sources

### Danmarks Statistik (DST) — StatBank API

**API base URL:** `https://api.statbank.dk/v1`

Key endpoints:
- `POST /tableinfo` — metadata for a table (variables, codes, descriptions).
- `POST /data` — data retrieval in various formats (JSONSTAT, BULK CSV, etc.).

**Authentication:** None required for public tables.

#### OFF3 — Offentlig forvaltning og service, udgifter og indtægter

**DST page:** Search for "OFF3" at statbank.dk

**What it contains:** Public-sector expenditures and revenues in millions of DKK,
annual grain, from 1971 to present. The core aggregate table for Danish public
finances.

**Dimensions:**
- `UI` (category) — 76 expenditure/revenue line items, hierarchically numbered
  (e.g. "1. Udgifter i alt", "1.1. Aflønning af ansatte", "2.19. Offentlig saldo").
- `SEKTOR` (sector) — 6 values: total public sector, state, social funds,
  municipalities+regions, regions, municipalities.
- `Tid` (date) — Annual, from 1971 onward.

**Value column:** `INDHOLD` — millions of DKK.

**Gotchas discovered during implementation:**
- The BULK format returns **text descriptions** for dimension values, not short
  code IDs. E.g. "Offentlig forvaltning og service" instead of "TOTAL".
- DST uses `..` to represent missing/suppressed values. These are parsed as null.
- Some numeric-looking category codes (e.g. "1", "1.1") can be misinterpreted as
  floats by CSV parsers. The silver transform reads all columns as strings first
  to preserve the original codes.
- Date values use DST-specific formats: `"2024"` (yearly), `"2024K1"` (quarterly),
  `"2024M03"` (monthly). OFF3 is yearly only.
- Value strings may contain spaces as thousand separators or use commas as decimal
  separators. The silver transform strips these before casting to float.

**Bronze location:** `data/bronze/dst/OFF3/run_date=YYYY-MM-DD/`
- `metadata.json` — raw API metadata response
- `raw.csv` — BULK format (semicolon-separated)

**Silver location:** `data/silver/dst/off3.parquet`
- Columns: `category` (str), `sector` (str), `date` (Date), `value` (Float64)
- 11,000+ rows covering 1971–2025

---

## Gold Layer — Dimensions

### dim_institution (SCD Type 2)

The central dimension table. Every fact joins to it. Models the full hierarchy
of Danish public-sector entities.

**Location:** `data/gold/dim_institution.parquet`

**Columns:**

| Column | Type | Description |
|---|---|---|
| `inst_key` | Int64 | Surrogate key, unique per row (version). |
| `entity_key` | String | Business key, stable across SCD2 versions. E.g. `STAT`, `MIN_FINANS`, `KOM_0101`. |
| `name_da` | String | Danish name. |
| `name_en` | String | English name. |
| `inst_type` | String | `stat`, `ministerium`, `styrelse`, `region`, `kommune`. |
| `inst_subtype` | String | More specific: `styrelse`, `direktorat`, `tilsyn`, `institut`, `fond` (nullable). |
| `sector_esa2010` | String | ESA 2010 sector code: `S1311` (central govt), `S1312` (regional), `S1313` (local). |
| `is_general_government` | Boolean | True for all general government entities. |
| `parent_entity_key` | String | References another `entity_key`. Null for root (STAT). |
| `hierarchy_path` | String | Full path: `STAT/MIN_FINANS/STY_SKAT`. |
| `hierarchy_depth` | Int32 | 0 for STAT, 1 for ministerier/regioner, 2 for styrelser/kommuner. |
| `geo_code` | String | DST municipality/region code (nullable for non-geographic units). |
| `geo_level` | String | `national`, `region`, `kommune` (nullable). |
| `valid_from` | Date | SCD2: when this version became effective. |
| `valid_to` | Date | SCD2: `9999-12-31` for current rows. |
| `is_current` | Boolean | True iff `valid_to = 9999-12-31`. |
| `source_system` | String | `seed+dst`. |
| `loaded_at` | Datetime | When this row was loaded. |
| `record_hash` | UInt64 | Hash of logical columns, for change detection. |

**SCD Type 2 worked example:**

If Skatteforvaltningen moves from Skatteministeriet to Finansministeriet on
2026-01-01:

```
inst_key | entity_key | parent_entity_key | valid_from | valid_to   | is_current
---------|------------|-------------------|------------|------------|-----------
42       | STY_SKAT   | MIN_SKATTER       | 2025-01-01 | 2025-12-31 | false
158      | STY_SKAT   | MIN_FINANS        | 2026-01-01 | 9999-12-31 | true
```

Both rows share `entity_key = STY_SKAT` but have different `inst_key`s.

**Querying "parent ministerium of X as of date D":**

```sql
select p.name_da as ministerium
from dim_institution c
join dim_institution p
  on c.parent_entity_key = p.entity_key
  and D between p.valid_from and p.valid_to
where c.entity_key = 'STY_SKAT'
  and D between c.valid_from and c.valid_to;
```

**Population:** 158 rows (1 stat + 19 ministerier + 34 styrelser + 5 regioner
+ 99 kommuner). Kommuner auto-loaded from DST FOLK1A register.

### dim_date

Standard date dimension, daily grain from 1990-01-01 to 2050-12-31.

**Location:** `data/gold/dim_date.parquet`

**Columns:**

| Column | Type | Description |
|---|---|---|
| `date_key` | Int32 | Surrogate key, YYYYMMDD integer. |
| `date` | Date | Calendar date. |
| `year` | Int32 | Calendar year. |
| `quarter` | UInt32 | Quarter (1–4). |
| `month` | Int32 | Month (1–12). |
| `month_name_da` | String | Danish month name (e.g. "januar"). |
| `month_name_en` | String | English month name (e.g. "January"). |
| `day` | Int32 | Day of month. |
| `iso_week` | UInt32 | ISO week number. |
| `is_weekend` | Boolean | True for Saturday/Sunday. |
| `fiscal_year_dk` | Int32 | Danish fiscal year (= calendar year). |

**Population:** 22,280 rows.

### dim_metric

Maps internal metric codes to upstream source identifiers.

**Location:** `data/gold/dim_metric.parquet`

**Columns:**

| Column | Type | Description |
|---|---|---|
| `metric_key` | Int64 | Surrogate key. |
| `metric_code` | String | Internal code, e.g. `public_balance`. |
| `name_da` | String | Danish name. |
| `name_en` | String | English name. |
| `unit` | String | `DKK_mio`. |
| `category` | String | `expenditure`, `revenue`, or `balance`. |
| `subcategory` | String | More specific: `total`, `operating`, `tax`, etc. |
| `source_system` | String | `dst`. |
| `source_identifier` | String | Lineage: `OFF3:UI=<exact category text>`. |

**Population:** 12 rows. See ADR 004 for selection rationale.

### dim_source

One row per upstream data source.

**Location:** `data/gold/dim_source.parquet`

**Columns:**

| Column | Type | Description |
|---|---|---|
| `source_key` | Int64 | Surrogate key. |
| `source_code` | String | Short code: `dst`, `dn`, `finanslov`, `opendata_dk`. |
| `name_da` | String | Danish name. |
| `name_en` | String | English name. |
| `api_base_url` | String | API base URL (nullable). |

**Population:** 4 rows.

---

## Gold Layer — Facts

### fct_economic_metric

Central fact table joining to all four dimensions. One row per
metric × date × institution × source.

**Location:** `data/gold/fct_economic_metric.parquet`

**Columns:**

| Column | Type | Description |
|---|---|---|
| `date_key` | Int32 | FK → dim_date. |
| `inst_key` | Int64 | FK → dim_institution. |
| `metric_key` | Int64 | FK → dim_metric. |
| `source_key` | Int64 | FK → dim_source. |
| `value` | Float64 | Metric value in the unit defined by dim_metric. |

**Population:** ~432 rows (12 metrics × ~36 years). Only the consolidated
"Offentlig forvaltning og service" sector is mapped (entity `STAT`).

**Convenience view:** `v_metric_timeseries` pre-joins fct_economic_metric with
all four dimension tables for direct querying.
