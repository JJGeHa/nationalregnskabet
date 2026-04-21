"""Finanslov API: query state budget data by paragraf/ministry."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter(prefix="/finanslov", tags=["finanslov"])


# ---------- schemas ----------


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


class TreemapNode(BaseModel):
    """A node in the budget treemap hierarchy."""

    name: str
    paragraf_nr: str
    value: float
    category: str  # "indtaegt", "udgift", or "finansiering"
    children: list[TreemapChild]


class TreemapChild(BaseModel):
    name: str
    hovedomraade_nr: str
    value: float


class TreemapResponse(BaseModel):
    year: int
    total: float
    total_indtaegt: float
    total_udgift: float
    total_finansiering: float
    children: list[TreemapNode]


# Classification of paragraffer into income/expenditure/financing
PARAGRAF_CATEGORY: dict[str, str] = {
    "38": "indtaegt",  # Skatter og afgifter
    "42": "finansiering",  # Afdrag på statsgælden
    "40": "finansiering",  # Genudlån mv.
    "37": "finansiering",  # Renter
    "41": "finansiering",  # Beholdningsbevægelser
}


class HovedområdeRow(BaseModel):
    hovedomraade_nr: str
    name: str
    finanslov: float
    regnskab: float | None


class ParagrafDetail(BaseModel):
    paragraf_nr: str
    paragraf_name: str
    year: int
    total_finanslov: float
    total_regnskab: float | None
    hovedomraader: list[HovedområdeRow]


class KontoRow(BaseModel):
    """A single hovedkonto-level line item."""

    hovedkonto_nr: str
    name: str
    finanslov: float


class HovedområdeDetail(BaseModel):
    """Breakdown of a single hovedområde into its konti."""

    paragraf_nr: str
    paragraf_name: str
    hovedomraade_nr: str
    hovedomraade_name: str
    year: int
    total_finanslov: float
    konti: list[KontoRow]


# ---------- endpoints ----------


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
            entity_key=row[0],
            name_da=row[1],
            name_en=row[2],
            value=row[3],
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


@router.get("/treemap", response_model=TreemapResponse)
def get_finanslov_treemap(
    year: int = Query(default=2024, description="Fiscal year"),
) -> TreemapResponse:
    """Return hierarchical budget data for treemap visualization."""
    conn = get_connection()

    sql = """
        SELECT
            paragraf_nr,
            paragraf_name,
            hovedomraade_nr,
            hovedomraade_name,
            finanslov
        FROM finanslov_detail
        WHERE fiscal_year = ?
        ORDER BY paragraf_nr, hovedomraade_nr
    """
    rows = conn.execute(sql, [year]).fetchall()
    conn.close()

    # Group by paragraf
    par_map: dict[str, TreemapNode] = {}
    for par_nr, par_name, ho_nr, ho_name, fl_val in rows:
        if fl_val is None:
            continue
        cat = PARAGRAF_CATEGORY.get(par_nr, "udgift")
        if par_nr not in par_map:
            par_map[par_nr] = TreemapNode(
                name=par_name,
                paragraf_nr=par_nr,
                value=0.0,
                category=cat,
                children=[],
            )
        node = par_map[par_nr]
        node.value += fl_val
        node.children.append(
            TreemapChild(
                name=ho_name,
                hovedomraade_nr=ho_nr,
                value=fl_val,
            )
        )

    children = sorted(
        par_map.values(), key=lambda n: abs(n.value), reverse=True
    )
    total = sum(n.value for n in children)
    total_indtaegt = sum(
        n.value for n in children if n.category == "indtaegt"
    )
    total_udgift = sum(
        n.value for n in children if n.category == "udgift"
    )
    total_finansiering = sum(
        n.value for n in children if n.category == "finansiering"
    )

    return TreemapResponse(
        year=year,
        total=total,
        total_indtaegt=total_indtaegt,
        total_udgift=total_udgift,
        total_finansiering=total_finansiering,
        children=children,
    )


@router.get("/paragraf/{nr}", response_model=ParagrafDetail)
def get_paragraf_detail(
    nr: str,
    year: int = Query(default=2024, description="Fiscal year"),
) -> ParagrafDetail:
    """Return breakdown of a single paragraf by hovedområde."""
    conn = get_connection()
    padded = nr.zfill(2)

    sql = """
        SELECT
            hovedomraade_nr,
            hovedomraade_name,
            finanslov,
            regnskab_minus2
        FROM finanslov_detail
        WHERE fiscal_year = ?
          AND paragraf_nr = ?
        ORDER BY finanslov DESC
    """
    rows = conn.execute(sql, [year, padded]).fetchall()

    name_row = conn.execute(
        """SELECT DISTINCT paragraf_name
           FROM finanslov_detail
           WHERE paragraf_nr = ? LIMIT 1""",
        [padded],
    ).fetchone()
    conn.close()

    par_name = name_row[0] if name_row else f"§{padded}"

    ho_rows = [
        HovedområdeRow(
            hovedomraade_nr=r[0],
            name=r[1],
            finanslov=r[2] or 0.0,
            regnskab=r[3],
        )
        for r in rows
    ]

    total_fl = sum(h.finanslov for h in ho_rows)
    total_reg = sum(h.regnskab for h in ho_rows if h.regnskab is not None)

    return ParagrafDetail(
        paragraf_nr=padded,
        paragraf_name=par_name,
        year=year,
        total_finanslov=total_fl,
        total_regnskab=total_reg if total_reg else None,
        hovedomraader=ho_rows,
    )


@router.get("/timeseries", response_model=FinanslovTimeseries)
def get_finanslov_timeseries(
    entity: str = Query(
        default="STAT",
        description="Entity key (ministry or paragraf)",
    ),
    year_from: int = Query(default=2010, alias="from"),
    year_to: int = Query(default=2024, alias="to"),
) -> FinanslovTimeseries:
    """Return appropriation vs actual over time for an entity."""
    conn = get_connection()

    name_row = conn.execute(
        "SELECT name_da FROM dim_institution "
        "WHERE entity_key = ? AND is_current",
        [entity],
    ).fetchone()
    name_da = name_row[0] if name_row else entity

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
            year=yr,
            appropriation=data["appropriation"],
            actual=data["actual"],
        )
        for yr, data in sorted(by_year.items())
    ]

    return FinanslovTimeseries(
        entity_key=entity, name_da=name_da, points=points
    )


@router.get(
    "/paragraf/{nr}/hovedomraade/{ho}",
    response_model=HovedområdeDetail,
)
def get_hovedomraade_detail(
    nr: str,
    ho: str,
    year: int = Query(default=2024, description="Fiscal year"),
) -> HovedområdeDetail:
    """Return breakdown of a single hovedområde into its konti."""
    conn = get_connection()
    padded_nr = nr.zfill(2)

    sql = """
        SELECT
            hovedkonto_nr,
            hovedkonto_name,
            SUM(finanslov) as finanslov
        FROM finanslov_konto
        WHERE fiscal_year = ?
          AND paragraf_nr = ?
          AND hovedomraade_nr = ?
        GROUP BY hovedkonto_nr, hovedkonto_name
        ORDER BY finanslov DESC
    """
    rows = conn.execute(sql, [year, padded_nr, ho]).fetchall()

    # Get names
    meta = conn.execute(
        """SELECT DISTINCT paragraf_name, hovedomraade_name
           FROM finanslov_konto
           WHERE paragraf_nr = ? AND hovedomraade_nr = ?
           LIMIT 1""",
        [padded_nr, ho],
    ).fetchone()
    conn.close()

    par_name = meta[0] if meta else f"§{padded_nr}"
    ho_name = meta[1] if meta else ho

    konti = [
        KontoRow(
            hovedkonto_nr=r[0],
            name=r[1],
            finanslov=r[2] or 0.0,
        )
        for r in rows
        if r[2] is not None and abs(r[2]) > 0.1
    ]

    total = sum(k.finanslov for k in konti)

    return HovedområdeDetail(
        paragraf_nr=padded_nr,
        paragraf_name=par_name,
        hovedomraade_nr=ho,
        hovedomraade_name=ho_name,
        year=year,
        total_finanslov=total,
        konti=konti,
    )
