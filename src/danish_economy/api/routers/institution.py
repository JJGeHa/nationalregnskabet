"""Institution hierarchy API: browse the public-sector tree."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from danish_economy.warehouse import get_connection

router = APIRouter(prefix="/institutions", tags=["institutions"])


class InstitutionNode(BaseModel):
    entity_key: str
    name_da: str
    name_en: str
    inst_type: str
    parent_entity_key: str | None
    budget: float | None = None
    children: list[InstitutionNode] = []


class InstitutionDetail(BaseModel):
    entity_key: str
    name_da: str
    name_en: str
    inst_type: str
    parent_entity_key: str | None
    sector_esa2010: str | None
    budget: float | None
    budget_actual: float | None
    children: list[InstitutionSummary]


class InstitutionSummary(BaseModel):
    entity_key: str
    name_da: str
    inst_type: str
    budget: float | None


@router.get("/tree", response_model=list[InstitutionNode])
def get_institution_tree(
    year: int = Query(default=2024),
    root: str = Query(default="STAT", description="Root entity_key"),
) -> list[InstitutionNode]:
    """Return the institution hierarchy as a tree with budget values."""
    conn = get_connection()

    # All current institutions
    inst_rows = conn.execute("""
        SELECT entity_key, name_da, name_en, inst_type,
               parent_entity_key
        FROM dim_institution
        WHERE is_current = true
    """).fetchall()

    # Budget per entity for the year (FL appropriation)
    budget_rows = conn.execute("""
        SELECT i.entity_key, f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        JOIN dim_source s ON f.source_key = s.source_key
        WHERE m.metric_code = 'fl_appropriation'
          AND s.source_code = 'finanslov'
          AND d.year = ?
          AND i.is_current = true
    """, [year]).fetchall()
    conn.close()

    budgets: dict[str, float] = {r[0]: r[1] for r in budget_rows}

    # Build lookup and children map
    nodes: dict[str, dict[str, object]] = {}
    children_map: dict[str, list[str]] = {}
    for ek, name_da, name_en, itype, parent in inst_rows:
        nodes[ek] = {
            "entity_key": ek,
            "name_da": name_da,
            "name_en": name_en,
            "inst_type": itype,
            "parent_entity_key": parent,
        }
        if parent:
            children_map.setdefault(parent, []).append(ek)

    def _build(ek: str) -> InstitutionNode:
        n = nodes[ek]
        child_keys = children_map.get(ek, [])
        child_nodes = [
            _build(ck) for ck in child_keys if ck in nodes
        ]
        # Sort children: those with budgets first (by abs value desc)
        child_nodes.sort(
            key=lambda c: abs(c.budget or 0), reverse=True
        )
        return InstitutionNode(
            entity_key=str(n["entity_key"]),
            name_da=str(n["name_da"]),
            name_en=str(n["name_en"]),
            inst_type=str(n["inst_type"]),
            parent_entity_key=(
                str(n["parent_entity_key"])
                if n["parent_entity_key"]
                else None
            ),
            budget=budgets.get(ek),
            children=child_nodes,
        )

    if root not in nodes:
        return []

    return [_build(root)]


@router.get("/{entity_key}", response_model=InstitutionDetail)
def get_institution_detail(
    entity_key: str,
    year: int = Query(default=2024),
) -> InstitutionDetail:
    """Return detail for a single institution with children."""
    conn = get_connection()

    row = conn.execute("""
        SELECT entity_key, name_da, name_en, inst_type,
               parent_entity_key, sector_esa2010
        FROM dim_institution
        WHERE entity_key = ? AND is_current = true
    """, [entity_key]).fetchone()

    if not row:
        conn.close()
        from fastapi import HTTPException

        raise HTTPException(404, f"Institution {entity_key} not found")

    ek, name_da, name_en, itype, parent, sector = row

    # Budget for this entity
    budget_row = conn.execute("""
        SELECT f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        JOIN dim_source s ON f.source_key = s.source_key
        WHERE i.entity_key = ?
          AND m.metric_code = 'fl_appropriation'
          AND s.source_code = 'finanslov'
          AND d.year = ?
          AND i.is_current = true
    """, [entity_key, year]).fetchone()

    actual_row = conn.execute("""
        SELECT f.value
        FROM fct_economic_metric f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_institution i ON f.inst_key = i.inst_key
        JOIN dim_metric m ON f.metric_key = m.metric_key
        JOIN dim_source s ON f.source_key = s.source_key
        WHERE i.entity_key = ?
          AND m.metric_code = 'fl_actual'
          AND s.source_code = 'finanslov'
          AND d.year = ?
          AND i.is_current = true
    """, [entity_key, year]).fetchone()

    # Children
    child_rows = conn.execute("""
        SELECT i.entity_key, i.name_da, i.inst_type,
               fl.value as budget
        FROM dim_institution i
        LEFT JOIN (
            SELECT f.inst_key, f.value
            FROM fct_economic_metric f
            JOIN dim_date d ON f.date_key = d.date_key
            JOIN dim_metric m ON f.metric_key = m.metric_key
            JOIN dim_source s ON f.source_key = s.source_key
            WHERE m.metric_code = 'fl_appropriation'
              AND s.source_code = 'finanslov'
              AND d.year = ?
        ) fl ON i.inst_key = fl.inst_key
        WHERE i.parent_entity_key = ?
          AND i.is_current = true
        ORDER BY ABS(COALESCE(fl.value, 0)) DESC
    """, [year, entity_key]).fetchall()
    conn.close()

    children = [
        InstitutionSummary(
            entity_key=cr[0],
            name_da=cr[1],
            inst_type=cr[2],
            budget=cr[3],
        )
        for cr in child_rows
    ]

    return InstitutionDetail(
        entity_key=ek,
        name_da=name_da,
        name_en=name_en,
        inst_type=itype,
        parent_entity_key=parent,
        sector_esa2010=sector,
        budget=budget_row[0] if budget_row else None,
        budget_actual=actual_row[0] if actual_row else None,
        children=children,
    )
