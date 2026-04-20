# ADR 003: Institution seed strategy

## Status
Accepted

## Context
`dim_institution` models the full hierarchy of Danish public-sector entities:
stat → ministerier → styrelser, plus regioner and kommuner. No single
machine-readable source publishes this complete hierarchy.

## Decision
Use a **hybrid strategy**:

1. **Hand-curated YAML** for STAT, ministerier (~19), and major styrelser (~34).
   These change rarely (government reshuffles, roughly once per election cycle)
   and require editorial judgment about naming and classification.

2. **DST register** (FOLK1A OMRÅDE variable) for kommuner (99) and regioner (5).
   These are published authoritatively by Danmarks Statistik and should not be
   hand-typed.

The loader in `dim_institution.py` merges both sources and computes the full
hierarchy (paths, depths, record hashes) at build time.

## Rationale

**Why not hand-type kommuner?** 99 entries with codes, names, and region
assignments is error-prone. DST's register is the single source of truth for
Danish municipality codes.

**Why hand-curate ministerier and styrelser?** The ministerium → styrelse
hierarchy is not published in a stable machine-readable format. Ministerier
restructure irregularly (a styrelse may move between ministerier, or new ones
are created). Hand-curation with SCD Type 2 versioning captures these changes
accurately and lets us flag uncertainty rather than silently guessing.

**Why not scrape fm.dk?** The Finansministeriet website lists the current
government structure but doesn't provide historical versions or a stable API.
Scraping would add fragility without adding accuracy beyond what we can
maintain by hand for ~50 entities.

## Trade-offs
If a government reshuffle happens, someone must update the YAML and run the
loader with a new `change_date`. The SCD2 merge will close out old versions
and create new ones automatically. This is a 15-minute manual task, not a
system design problem.
