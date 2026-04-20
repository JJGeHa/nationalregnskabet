# ADR 004: Metric taxonomy and OFF3 mapping strategy

## Status
Accepted

## Context
OFF3 contains 76 expenditure/revenue line items (the `UI` dimension). We need to
decide which metrics to surface in the gold layer, how to identify them, and how
to handle the mapping between DST's text-based category descriptions and our
internal metric codes.

## Decision

1. **12 initial metrics** selected from OFF3's hierarchical structure: the major
   aggregates (total expenditure/revenue, balance) plus the largest component
   line items (compensation, consumption, subsidies, social benefits, taxes,
   interest). These are defined in `src/danish_economy/etl/seeds/dim_metric.yaml`.

2. **Source identifier format:** `OFF3:UI=<exact category text>`. The text after
   `=` must match the silver `category` column character-for-character, because
   DST's BULK format returns full Danish text descriptions, not short codes.

3. **Single-sector mapping:** Only "Offentlig forvaltning og service" (the
   consolidated total) maps to entity `STAT`. Sub-sectors (state, regions,
   municipalities) are not mapped yet to avoid double-counting.

4. **YAML seed over code:** Metric definitions live in a declarative YAML seed
   rather than being hard-coded in Python. This makes it easy to add new metrics
   (add a YAML entry, re-run the build) without modifying mapping code.

## Rationale

**Why 12 metrics, not all 76?** Most OFF3 line items are sub-components that
sum into higher aggregates. Surfacing all 76 would create a confusing UI. The 12
chosen metrics cover the fiscal story (revenue vs. expenditure vs. balance) and
the largest cost/revenue drivers. More can be added incrementally.

**Why exact text matching?** DST's BULK format provides no stable short codes for
the `UI` dimension. The category text *is* the identifier. Fuzzy matching would
be fragile and hard to debug. Exact matching is explicit — if DST changes the
text in a future release, the mapping cleanly breaks with zero matched rows
rather than silently matching the wrong line item.

**Why single-sector only?** OFF3 reports the same metrics for 6 overlapping
sectors (total, state, social funds, municipalities+regions, regions,
municipalities). The "total" sector is the consolidated figure. Mapping multiple
sectors without a sector dimension in the fact table would produce duplicate
values. A future prompt can add a sector dimension if sub-sector analysis is
needed.

## Trade-offs

- The exact-text strategy is brittle to DST text changes. If DST updates a
  category description, the mapping produces zero rows for that metric. The
  `build_fct_economic_metric` function raises `ValueError` if it produces zero
  total rows, making this failure visible rather than silent.

- The 12-metric selection is opinionated. If a user needs a metric we haven't
  mapped, they must add a YAML entry. This is intentional — the mapping is a
  conscious curation step, not an automatic bulk import.
