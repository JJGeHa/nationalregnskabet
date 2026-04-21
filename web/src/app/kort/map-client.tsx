"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fmtDKK, fmtPct } from "../../lib/format";

const API_URL = "http://localhost:8000";

interface MapData {
  metric: string;
  year: number;
  values: Record<string, { entity_key: string; name: string; value: number }>;
}

const METRICS = [
  { code: "kommune_tax_rate", label: "Kommuneskat (%)" },
  { code: "kommune_service_cost", label: "Serviceudgifter pr. indb. (kr.)" },
  {
    code: "kommune_debt_per_capita",
    label: "Langfristet gaeld pr. indb. (kr.)",
  },
];

export function KommuneMap() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [metric, setMetric] = useState(METRICS[0].code);
  const metricRef = useRef(metric);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    metricRef.current = metric;
  }, [metric]);

  // Fetch map data when metric changes
  useEffect(() => {
    fetch(`${API_URL}/kommuner/map-data?metric=${metric}&year=2023`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMapData)
      .catch(() => setMapData(null));
  }, [metric]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;

    let cancelled = false;

    async function initMap() {
      // Dynamic import to avoid SSR issues
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (cancelled || !mapRef.current) return;

      const map = new maplibregl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#f0f0f0" },
            },
          ],
        },
        center: [10.8, 55.7],
        zoom: 5.8,
        maxBounds: [
          [5.5, 53.5],
          [16.0, 58.5],
        ],
      });

      map.on("load", () => {
        map.addSource("kommuner", {
          type: "geojson",
          data: "/kommuner.geojson",
        });

        map.addLayer({
          id: "kommuner-fill",
          type: "fill",
          source: "kommuner",
          paint: {
            "fill-color": "#ccc",
            "fill-opacity": 0.8,
          },
        });

        map.addLayer({
          id: "kommuner-border",
          type: "line",
          source: "kommuner",
          paint: {
            "line-color": "#fff",
            "line-width": 1,
          },
        });

        setMapLoaded(true);

        // Store map instance for data updates
        (mapRef.current as HTMLDivElement & { _map?: typeof map })._map = map;
      });

      map.on("mousemove", "kommuner-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          const name = props?.navn || "Unknown";
          const val = props?.dataValue;
          if (val !== undefined && val !== null) {
            const n = Number(val);
            const active = metricRef.current;
            const formatted =
              active === "kommune_tax_rate" ? fmtPct(n, 2) : fmtDKK(n);
            setTooltip(`${name}: ${formatted}`);
          } else {
            setTooltip(name);
          }
          map.getCanvas().style.cursor = "pointer";
        }
      });

      map.on("mouseleave", "kommuner-fill", () => {
        setTooltip(null);
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "kommuner-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const kode = e.features[0].properties?.kode;
          if (kode) {
            router.push(`/kommuner/KOM_${kode}`);
          }
        }
      });
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [mapLoaded, router]);

  // Update colors when data changes
  useEffect(() => {
    if (!mapData || !mapLoaded || !mapRef.current) return;

    const el = mapRef.current as HTMLDivElement & { _map?: unknown };
    // biome-ignore lint/suspicious/noExplicitAny: maplibre map instance
    const map = el._map as any;
    if (!map) return;

    const values = Object.values(mapData.values).map((v) => v.value);
    if (values.length === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Update source data with values embedded in properties
    const source = map.getSource("kommuner");
    if (!source) return;

    fetch("/kommuner.geojson")
      .then((r) => r.json())
      .then(
        (geojson: {
          features: {
            properties: Record<string, string | number | null>;
          }[];
        }) => {
          for (const feature of geojson.features) {
            const kode = feature.properties.kode as string;
            const entry = mapData.values[kode];
            feature.properties.dataValue = entry ? entry.value : null;
          }

          source.setData(geojson);

          // Color scale: blue gradient
          map.setPaintProperty("kommuner-fill", "fill-color", [
            "case",
            ["!=", ["get", "dataValue"], null],
            [
              "interpolate",
              ["linear"],
              ["get", "dataValue"],
              min,
              "#dbeafe",
              (min + max) / 2,
              "#3b82f6",
              max,
              "#1e3a5f",
            ],
            "#e5e5e5",
          ]);
        },
      );
  }, [mapData, mapLoaded]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {METRICS.map((m) => (
          <button
            type="button"
            key={m.code}
            onClick={() => setMetric(m.code)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              metric === m.code
                ? "bg-[var(--foreground)] text-white"
                : "bg-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div ref={mapRef} className="h-[600px] w-full" />
        {tooltip && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-[var(--surface)]/95 px-3 py-1.5 text-[13px] font-medium shadow-md">
            {tooltip}
          </div>
        )}
      </div>
    </div>
  );
}
