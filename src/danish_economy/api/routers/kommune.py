"""Kommune API: compare metrics across kommuner."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter(prefix="/kommuner", tags=["kommuner"])


class KommuneMetricRow(BaseModel):
    entity_key: str
    name_da: str
    year: int
    value: float


class KommuneCompare(BaseModel):
    metric: str
    metric_name_da: str
    unit: str
    data: list[KommuneMetricRow]


class KommuneListItem(BaseModel):
    entity_key: str
    name_da: str
    region: str


@router.get("/list", response_model=list[KommuneListItem])
def list_kommuner() -> list[KommuneListItem]:
    """Return all kommuner with their regions."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            k.entity_key,
            k.name_da,
            COALESCE(r.name_da, '') as region
        FROM dim_institution k
        LEFT JOIN dim_institution r
            ON k.parent_entity_key = r.entity_key
            AND r.is_current
        WHERE k.inst_type = 'kommune'
          AND k.is_current
        ORDER BY k.name_da
    """).fetchall()
    conn.close()
    return [
        KommuneListItem(entity_key=r[0], name_da=r[1], region=r[2])
        for r in rows
    ]


@router.get("/compare", response_model=KommuneCompare)
def compare_kommuner(
    metric: str = Query(..., description="Metric code"),
    entities: str = Query(
        ..., description="Comma-separated entity keys"
    ),
    year: int = Query(default=2023, description="Year to compare"),
) -> KommuneCompare:
    """Compare a metric across multiple kommuner for a given year."""
    conn = get_connection()
    entity_list = [e.strip() for e in entities.split(",")]
    placeholders = ",".join(["?"] * len(entity_list))

    # Get metric info
    metric_row = conn.execute(
        "SELECT name_da, unit FROM dim_metric WHERE metric_code = ?",
        [metric],
    ).fetchone()
    metric_name_da = metric_row[0] if metric_row else metric
    unit = metric_row[1] if metric_row else ""

    sql = f"""
        SELECT
            i.entity_key,
            i.name_da,
            d.year,
            f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        WHERE m.metric_code = ?
          AND d.year = ?
          AND i.entity_key IN ({placeholders})
          AND i.is_current
        ORDER BY f.value DESC
    """
    rows = conn.execute(sql, [metric, year, *entity_list]).fetchall()
    conn.close()

    return KommuneCompare(
        metric=metric,
        metric_name_da=metric_name_da,
        unit=unit,
        data=[
            KommuneMetricRow(
                entity_key=r[0], name_da=r[1], year=r[2], value=r[3]
            )
            for r in rows
        ],
    )


@router.get("/map-data")
def get_map_data(
    metric: str = Query(..., description="Metric code"),
    year: int = Query(default=2023, description="Year"),
) -> dict[str, object]:
    """Return metric values for all kommuner (for choropleth map)."""
    conn = get_connection()
    sql = """
        SELECT
            i.entity_key,
            i.name_da,
            i.geo_code,
            f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        WHERE m.metric_code = ?
          AND d.year = ?
          AND i.inst_type = 'kommune'
          AND i.is_current
    """
    rows = conn.execute(sql, [metric, year]).fetchall()
    conn.close()

    # Return as dict keyed by geo_code (4-digit, zero-padded)
    values: dict[str, dict[str, str | float]] = {}
    for r in rows:
        geo_code = r[2]
        if geo_code:
            # Ensure 4-digit zero-padded code for GeoJSON matching
            padded = str(geo_code).zfill(4)
            values[padded] = {
                "entity_key": r[0],
                "name": r[1],
                "value": r[3],
            }

    return {"metric": metric, "year": year, "values": values}


class KommuneMetricValue(BaseModel):
    metric_code: str
    name_da: str
    unit: str
    value: float
    year: int
    national_avg: float | None


class KommuneDetail(BaseModel):
    entity_key: str
    name_da: str
    name_en: str
    region: str
    geo_code: str | None
    metrics: list[KommuneMetricValue]


@router.get("/{entity_key}", response_model=KommuneDetail)
def get_kommune_detail(
    entity_key: str,
    year: int = Query(default=2024),
) -> KommuneDetail:
    """Return all metrics for a single kommune with national averages."""
    conn = get_connection()

    inst = conn.execute(
        """SELECT entity_key, name_da, name_en, geo_code,
                  parent_entity_key
           FROM dim_institution
           WHERE entity_key = ? AND is_current AND inst_type = 'kommune'""",
        [entity_key],
    ).fetchone()
    if not inst:
        conn.close()
        from fastapi import HTTPException

        raise HTTPException(404, f"Kommune {entity_key} not found")

    region_row = conn.execute(
        """SELECT name_da FROM dim_institution
           WHERE entity_key = ? AND is_current""",
        [inst[4]],
    ).fetchone()
    region = region_row[0] if region_row else ""

    # All metrics for this kommune, latest available year <= requested
    rows = conn.execute(
        """SELECT m.metric_code, m.name_da, m.unit, f.value, d.year
           FROM fct_economic_metric f
           JOIN dim_date d ON f.date_key = d.date_key
           JOIN dim_institution i ON f.inst_key = i.inst_key
           JOIN dim_metric m ON f.metric_key = m.metric_key
           WHERE i.entity_key = ?
             AND i.is_current
             AND d.year <= ?
           ORDER BY m.metric_code, d.year DESC""",
        [entity_key, year],
    ).fetchall()

    # Deduplicate: keep latest year per metric
    seen: set[str] = set()
    metric_rows: list[tuple[str, str, str, float, int]] = []
    for r in rows:
        if r[0] not in seen:
            seen.add(r[0])
            metric_rows.append(r)

    # National averages for the same metrics/years
    metrics: list[KommuneMetricValue] = []
    for mc, name_da, unit, value, yr in metric_rows:
        avg_row = conn.execute(
            """SELECT AVG(f.value)
               FROM fct_economic_metric f
               JOIN dim_date d ON f.date_key = d.date_key
               JOIN dim_institution i ON f.inst_key = i.inst_key
               JOIN dim_metric m ON f.metric_key = m.metric_key
               WHERE m.metric_code = ?
                 AND d.year = ?
                 AND i.inst_type = 'kommune'
                 AND i.is_current""",
            [mc, yr],
        ).fetchone()
        avg = avg_row[0] if avg_row else None

        metrics.append(
            KommuneMetricValue(
                metric_code=mc,
                name_da=name_da,
                unit=unit,
                value=value,
                year=yr,
                national_avg=round(avg, 2) if avg else None,
            )
        )

    conn.close()

    return KommuneDetail(
        entity_key=inst[0],
        name_da=inst[1],
        name_en=inst[2],
        region=region,
        geo_code=inst[3],
        metrics=metrics,
    )
