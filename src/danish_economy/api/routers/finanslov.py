"""Finanslov API: query state budget data by paragraf/ministry."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter(prefix="/finanslov", tags=["finanslov"])


class ParagrafRow(BaseModel):
    entity_key: str
    name_da: str
    name_en: str
    value: float


class FinanslovOverview(BaseModel):
    year: int
    metric: str
    total: float
    paragraffer: list[ParagrafRow]


class FinanslovTimeseriesPoint(BaseModel):
    year: int
    appropriation: float | None
    actual: float | None


class FinanslovTimeseries(BaseModel):
    entity_key: str
    name_da: str
    points: list[FinanslovTimeseriesPoint]


@router.get("/overview", response_model=FinanslovOverview)
def get_finanslov_overview(
    year: int = Query(default=2024, description="Fiscal year"),
) -> FinanslovOverview:
    """Return Finanslov breakdown by paragraf for a given year."""
    conn = get_connection()

    sql = """
        SELECT
            i.entity_key,
            i.name_da,
            i.name_en,
            f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        JOIN dim_source s ON f.source_key = s.source_key
        WHERE m.metric_code = 'fl_appropriation'
          AND s.source_code = 'finanslov'
          AND d.year = ?
          AND i.is_current = true
        ORDER BY f.value DESC
    """
    rows = conn.execute(sql, [year]).fetchall()
    conn.close()

    paragraffer = [
        ParagrafRow(
            entity_key=row[0], name_da=row[1], name_en=row[2], value=row[3]
        )
        for row in rows
    ]
    total = sum(p.value for p in paragraffer)

    return FinanslovOverview(
        year=year,
        metric="fl_appropriation",
        total=total,
        paragraffer=paragraffer,
    )


@router.get("/timeseries", response_model=FinanslovTimeseries)
def get_finanslov_timeseries(
    entity: str = Query(
        default="STAT", description="Entity key (ministry or paragraf)"
    ),
    year_from: int = Query(default=2010, alias="from"),
    year_to: int = Query(default=2024, alias="to"),
) -> FinanslovTimeseries:
    """Return appropriation vs actual over time for an entity."""
    conn = get_connection()

    # Get institution name
    name_row = conn.execute(
        "SELECT name_da FROM dim_institution WHERE entity_key = ? AND is_current",
        [entity],
    ).fetchone()
    name_da = name_row[0] if name_row else entity

    # For STAT, we need to aggregate all paragraffer
    if entity == "STAT":
        sql = """
            SELECT
                d.year,
                m.metric_code,
                SUM(f.value) as total
            FROM fct_economic_metric f
            JOIN dim_date d ON f.date_key = d.date_key
            JOIN dim_metric m ON f.metric_key = m.metric_key
            JOIN dim_source s ON f.source_key = s.source_key
            WHERE s.source_code = 'finanslov'
              AND m.metric_code IN ('fl_appropriation', 'fl_actual')
              AND d.year BETWEEN ? AND ?
            GROUP BY d.year, m.metric_code
            ORDER BY d.year
        """
        rows = conn.execute(sql, [year_from, year_to]).fetchall()
    else:
        sql = """
            SELECT
                d.year,
                m.metric_code,
                f.value
            FROM fct_economic_metric f
            JOIN dim_date d ON f.date_key = d.date_key
            JOIN dim_institution i ON f.inst_key = i.inst_key
            JOIN dim_metric m ON f.metric_key = m.metric_key
            JOIN dim_source s ON f.source_key = s.source_key
            WHERE i.entity_key = ?
              AND s.source_code = 'finanslov'
              AND m.metric_code IN ('fl_appropriation', 'fl_actual')
              AND d.year BETWEEN ? AND ?
              AND i.is_current = true
            ORDER BY d.year
        """
        rows = conn.execute(sql, [entity, year_from, year_to]).fetchall()
    conn.close()

    # Pivot: group by year, split appropriation vs actual
    by_year: dict[int, dict[str, float | None]] = {}
    for row in rows:
        yr, metric_code, val = row[0], row[1], row[2]
        if yr not in by_year:
            by_year[yr] = {"appropriation": None, "actual": None}
        if metric_code == "fl_appropriation":
            by_year[yr]["appropriation"] = val
        elif metric_code == "fl_actual":
            by_year[yr]["actual"] = val

    points = [
        FinanslovTimeseriesPoint(
            year=yr, appropriation=data["appropriation"], actual=data["actual"]
        )
        for yr, data in sorted(by_year.items())
    ]

    return FinanslovTimeseries(
        entity_key=entity, name_da=name_da, points=points
    )
