# ADR 002: Bronze retention policy

## Status
Accepted

## Context
Each ETL run writes raw API responses to `data/bronze/dst/{TABLE}/run_date=YYYY-MM-DD/`.
Over time this accumulates. Should we keep every run forever, or rotate?

## Decision
**Keep every bronze run.** No automatic rotation.

## Rationale
Bronze is the project's audit trail. If a silver or gold transform has a bug,
we can reprocess from bronze without re-fetching from upstream APIs that may have
changed their data since.

The data volume is small. OFF3 produces ~700KB per run. Even daily runs for a
year across a dozen tables would total under 5GB — trivial for modern storage.

Deletion is irreversible and the cost of keeping files is negligible. If storage
ever becomes a concern (unlikely at this scale), we can add a retention policy
then. Premature deletion optimises for a problem we don't have.

## Trade-offs
If the project later ingests high-frequency or high-volume sources (e.g. daily
kommune-level data with many tables), we may want to keep only the last N runs
per table. That policy can be added to the ingester as a flag without changing
the bronze directory structure.
