"""Transfer API: state-to-municipality transfer data."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter(prefix="/transfers", tags=["transfers"])

# Hovedområder that represent transfers to kommuner/regioner
TRANSFER_ITEMS = [
    ("16", "167", "Bloktilskud (kommuner og regioner)"),
    ("16", "169", "Øvrige tilskud til kommuner og regioner"),
    ("17", "176", "Sociale pensioner og boligstøtte"),
]


class TransferItem(BaseModel):
    paragraf_nr: str
    hovedomraade_nr: str
    label: str
    finanslov: float
    regnskab: float | None


class TransferOverview(BaseModel):
    year: int
    total: float
    items: list[TransferItem]


class TransferTimeseriesPoint(BaseModel):
    year: int
    bloktilskud: float | None
    social: float | None
    other: float | None
    total: float | None


class TransferTimeseries(BaseModel):
    points: list[TransferTimeseriesPoint]


@router.get("/overview", response_model=TransferOverview)
def get_transfer_overview(
    year: int = Query(default=2024),
) -> TransferOverview:
    """Return transfer amounts from state to kommuner/regioner."""
    conn = get_connection()
    items: list[TransferItem] = []

    for par_nr, ho_nr, label in TRANSFER_ITEMS:
        row = conn.execute(
            """SELECT finanslov, regnskab_minus2
               FROM finanslov_detail
               WHERE fiscal_year = ?
                 AND paragraf_nr = ?
                 AND hovedomraade_nr = ?""",
            [year, par_nr, ho_nr],
        ).fetchone()
        if row:
            items.append(
                TransferItem(
                    paragraf_nr=par_nr,
                    hovedomraade_nr=ho_nr,
                    label=label,
                    finanslov=row[0] or 0.0,
                    regnskab=row[1],
                )
            )

    conn.close()
    total = sum(i.finanslov for i in items)
    return TransferOverview(year=year, total=total, items=items)


@router.get("/timeseries", response_model=TransferTimeseries)
def get_transfer_timeseries(
    year_from: int = Query(default=2010, alias="from"),
    year_to: int = Query(default=2024, alias="to"),
) -> TransferTimeseries:
    """Return transfer amounts over time."""
    conn = get_connection()

    rows = conn.execute(
        """SELECT fiscal_year, paragraf_nr, hovedomraade_nr, finanslov
           FROM finanslov_detail
           WHERE fiscal_year BETWEEN ? AND ?
             AND (
               (paragraf_nr = '16' AND hovedomraade_nr = '167')
               OR (paragraf_nr = '16' AND hovedomraade_nr = '169')
               OR (paragraf_nr = '17' AND hovedomraade_nr = '176')
             )
           ORDER BY fiscal_year""",
        [year_from, year_to],
    ).fetchall()
    conn.close()

    by_year: dict[int, dict[str, float]] = {}
    for yr, par, ho, val in rows:
        if yr not in by_year:
            by_year[yr] = {"bloktilskud": 0, "social": 0, "other": 0}
        if par == "16" and ho == "167":
            by_year[yr]["bloktilskud"] = val or 0
        elif par == "17" and ho == "176":
            by_year[yr]["social"] = val or 0
        else:
            by_year[yr]["other"] += val or 0

    points = [
        TransferTimeseriesPoint(
            year=yr,
            bloktilskud=d["bloktilskud"],
            social=d["social"],
            other=d["other"],
            total=d["bloktilskud"] + d["social"] + d["other"],
        )
        for yr, d in sorted(by_year.items())
    ]

    return TransferTimeseries(points=points)
