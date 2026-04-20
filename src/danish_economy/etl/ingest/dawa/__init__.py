"""DAWA ingester: fetches Danish kommune GeoJSON boundaries.

Uses the pre-simplified GeoJSON from ok-dk/dagi (2.2 MB, 311 features)
and enriches with properties from DAWA JSON API.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

DATA_DIR = Path(__file__).resolve().parents[5] / "data"

# Pre-simplified GeoJSON (~2.2 MB vs 113 MB from DAWA direct)
GEOJSON_URL = (
    "https://raw.githubusercontent.com/ok-dk/dagi/master/"
    "geojson/kommuner.geojson"
)
# DAWA JSON API for enriching properties
DAWA_JSON_URL = (
    "https://api.dataforsyningen.dk/kommuner?format=json&struktur=mini"
)
TIMEOUT = 60.0


def ingest_kommune_geojson(data_dir: Path | None = None) -> Path:
    """Download and enrich kommune GeoJSON.

    Writes data/bronze/dawa/kommuner/run_date=YYYY-MM-DD/kommuner.geojson
    Returns the output path.
    """
    base = data_dir or DATA_DIR
    run_date = datetime.now(UTC).strftime("%Y-%m-%d")
    run_dir = base / "bronze" / "dawa" / "kommuner" / f"run_date={run_date}"
    run_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=TIMEOUT) as client:
        # 1. Download pre-simplified GeoJSON
        geo_resp = client.get(GEOJSON_URL)
        geo_resp.raise_for_status()
        geojson = geo_resp.json()

        # 2. Download DAWA properties for enrichment
        props_resp = client.get(DAWA_JSON_URL)
        props_resp.raise_for_status()
        dawa_props = props_resp.json()

    # Build lookup from kommune kode → DAWA properties
    dawa_lookup: dict[str, dict[str, str | float | bool]] = {}
    for item in dawa_props:
        kode = item["kode"]
        dawa_lookup[kode] = {
            "navn": item["navn"],
            "regionskode": item.get("regionskode", ""),
            "regionsnavn": item.get("regionsnavn", ""),
        }

    # Merge split polygons back to one feature per kommune
    # ok-dk/dagi splits MultiPolygons → individual Polygons (311 features)
    # We group by KOMKODE and merge back
    merged: dict[str, dict[str, Any]] = {}
    for feature in geojson["features"]:
        props = feature["properties"]
        komkode = props.get("KOMKODE") or props.get("lau_1", "")
        if not komkode:
            continue

        if komkode not in merged:
            # Start new feature
            dawa = dawa_lookup.get(komkode, {})
            coords: list[Any] = []
            merged[komkode] = {
                "type": "Feature",
                "properties": {
                    "kode": komkode,
                    "navn": dawa.get("navn") or props.get("KOMNAVN", ""),
                    "regionskode": dawa.get("regionskode", ""),
                    "regionsnavn": dawa.get("regionsnavn", ""),
                },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": coords,
                },
            }

        geom = feature["geometry"]
        geom_coords: list[Any] = merged[komkode]["geometry"]["coordinates"]
        if geom["type"] == "Polygon":
            geom_coords.append(geom["coordinates"])
        elif geom["type"] == "MultiPolygon":
            geom_coords.extend(geom["coordinates"])

    result = {
        "type": "FeatureCollection",
        "features": list(merged.values()),
    }

    out_path = run_dir / "kommuner.geojson"
    out_path.write_text(json.dumps(result), encoding="utf-8")
    print(f"Wrote {out_path} ({len(merged)} kommuner)")

    return out_path


def publish_geojson(data_dir: Path | None = None) -> Path:
    """Copy the latest bronze GeoJSON to web/public/ for frontend use."""
    base = data_dir or DATA_DIR
    bronze_dir = base / "bronze" / "dawa" / "kommuner"
    if not bronze_dir.exists():
        msg = f"No DAWA bronze data at {bronze_dir}"
        raise FileNotFoundError(msg)
    runs = sorted(bronze_dir.glob("run_date=*"))
    if not runs:
        msg = "No DAWA runs found"
        raise FileNotFoundError(msg)

    src = runs[-1] / "kommuner.geojson"
    # web/public/ is relative to repo root
    web_public = base.parent / "web" / "public"
    web_public.mkdir(parents=True, exist_ok=True)
    dst = web_public / "kommuner.geojson"

    import shutil

    shutil.copy2(src, dst)
    print(f"Published {dst}")
    return dst


if __name__ == "__main__":
    ingest_kommune_geojson()
    publish_geojson()
