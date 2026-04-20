"""Timeseries API: query metric values over time."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter()


class TimeseriesPoint(BaseModel):
    date: date
    value: float
    unit: str


class TimeseriesResponse(BaseModel):
    metric: str
    entity: str
    points: list[TimeseriesPoint]


@router.get("/timeseries", response_model=TimeseriesResponse)
def get_timeseries(
    metric: str = Query(..., description="Metric code, e.g. public_net_expenditure"),
    entity: str = Query(default="STAT", description="Entity key, e.g. STAT"),
    date_from: date | None = Query(
        default=None, alias="from", description="Start date (inclusive)"
    ),
    date_to: date | None = Query(
        default=None, alias="to", description="End date (inclusive)"
    ),
) -> TimeseriesResponse:
    """Return a timeseries of a metric for an entity over a date range."""
    conn = get_connection()

    # Validate metric exists
    check = conn.execute(
        "SELECT count(*) FROM dim_metric WHERE metric_code = ?", [metric]
    ).fetchone()
    if check is None or check[0] == 0:
        raise HTTPException(status_code=404, detail=f"Unknown metric: {metric}")

    # Validate entity exists
    check = conn.execute(
        "SELECT count(*) FROM dim_institution WHERE entity_key = ? AND is_current",
        [entity],
    ).fetchone()
    if check is None or check[0] == 0:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity}")

    # Build query
    sql = """
        SELECT date, value, unit
        FROM v_metric_timeseries
        WHERE metric_code = ?
          AND entity_key = ?
    """
    params: list[str | date] = [metric, entity]

    if date_from is not None:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to is not None:
        sql += " AND date <= ?"
        params.append(date_to)

    sql += " ORDER BY date"

    rows = conn.execute(sql, params).fetchall()
    conn.close()

    points = [
        TimeseriesPoint(date=row[0], value=row[1], unit=row[2]) for row in rows
    ]
    return TimeseriesResponse(metric=metric, entity=entity, points=points)
