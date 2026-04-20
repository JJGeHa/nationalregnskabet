# ADR 001: DuckDB as the analytical warehouse

## Status
Accepted

## Context
We need a warehouse layer for analytical queries over Danish public-sector
financial data. The workload is: read-heavy, single-writer ETL, analytical
aggregations over time-series and hierarchical dimensions, sub-second latency
for dashboard queries over datasets in the low millions of rows.

## Decision
Use **DuckDB** reading from Parquet files on disk. No database server process.

## Rationale

**Workload fit.** DuckDB is a columnar, OLAP-optimised engine. Our queries are
almost entirely aggregations, filters, and joins over typed columns — exactly
what columnar storage accelerates. Row-store databases (Postgres) would work but
leave performance on the table for this access pattern.

**Parquet-native.** DuckDB reads Parquet directly with predicate pushdown and
projection pruning. This means our gold-layer artifacts are portable files, not
locked inside a database. Any tool that reads Parquet (Polars, pandas, Spark)
can consume our warehouse independently.

**Operational simplicity.** No server to manage, no connection pooling, no
backup strategy beyond file copies. The warehouse is a derived artifact — if
lost, `make build-warehouse` regenerates it from bronze and silver Parquet. This
matters for a project that prioritises code clarity over infrastructure.

**Single-writer model.** Our ETL runs as a batch job (GitHub Actions cron or
local CLI). There is no concurrent write contention. DuckDB's single-writer
limitation is irrelevant for this workload.

## Trade-offs

If the project later requires concurrent multi-user writes (e.g. user
annotations, saved queries), we would reach for Postgres. The gold Parquet layer
makes this migration straightforward — Postgres can bulk-load from the same
files.

MongoDB or other document stores are a poor fit: the data is highly relational,
joins are central to the query patterns, and schema enforcement catches errors
early.
