"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState } from "react";
import { useContainerWidth } from "../../hooks/use-container-width";
import { fmtAxisKr, fmtDKK, fmtPct, fmtPromille } from "../../lib/format";

const API_URL = "http://localhost:8000";

const DEFAULT_KOMMUNER = [
  "KOM_0101",
  "KOM_0751",
  "KOM_0461",
  "KOM_0851",
  "KOM_0151",
  "KOM_0615",
  "KOM_0265",
  "KOM_0657",
  "KOM_0630",
  "KOM_0561",
].join(",");

const METRICS = [
  { code: "kommune_tax_rate", label: "Kommuneskat" },
  { code: "kommune_operating_cost", label: "Driftsudgifter pr. indb." },
  { code: "kommune_service_cost", label: "Serviceudgifter pr. indb." },
  { code: "kommune_debt_per_capita", label: "Langfristet gaeld pr. indb." },
  { code: "kommune_health_cost", label: "Sundhedsudgifter pr. indb." },
  { code: "kommune_education_cost", label: "Folkeskoleudgifter pr. elev" },
];

interface KommuneRow {
  entity_key: string;
  name_da: string;
  year: number;
  value: number;
}

interface KommuneCompare {
  metric: string;
  metric_name_da: string;
  unit: string;
  data: KommuneRow[];
}

function fmtValue(v: number, unit: string): string {
  if (unit === "pct") return fmtPct(v, 2);
  if (unit === "promille") return fmtPromille(v, 1);
  return fmtDKK(v);
}

export function KommuneCompareSection() {
  const [selected, setSelected] = useState(METRICS[0].code);
  const [data, setData] = useState<KommuneCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const { ref: chartRef, width } = useContainerWidth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(
      `${API_URL}/kommuner/compare?metric=${selected}&entities=${DEFAULT_KOMMUNER}&year=2023`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [selected]);

  // Render chart
  useEffect(() => {
    if (!containerRef.current || !data || data.data.length === 0) return;

    const sorted = [...data.data].sort((a, b) => b.value - a.value);

    const chart = Plot.plot({
      style: {
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: Math.max(width - 32, 300),
      height: Math.max(300, sorted.length * 36),
      marginLeft: 140,
      marginRight: 80,
      x: {
        label: null,
        grid: true,
        tickFormat:
          data.unit === "pct"
            ? (d: number) => fmtPct(d, 0)
            : data.unit === "promille"
              ? (d: number) => fmtPromille(d, 0)
              : (d: number) => fmtAxisKr(d),
      },
      y: { label: null },
      color: { scheme: "blues" },
      marks: [
        Plot.barX(sorted, {
          x: "value",
          y: "name_da",
          fill: "#2d4a8a",
          sort: { y: "-x" },
          rx: 3,
        }),
        Plot.text(sorted, {
          x: "value",
          y: "name_da",
          text: (d: KommuneRow) => fmtValue(d.value, data.unit),
          dx: 6,
          textAnchor: "start",
          fontSize: 12,
          fill: "#6b6b7b",
        }),
        Plot.tip(
          sorted,
          Plot.pointerY({
            x: "value",
            y: "name_da",
            title: (d: KommuneRow) =>
              `${d.name_da}\n${fmtValue(d.value, data.unit)}`,
          }),
        ),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data, width]);

  return (
    <section className="mt-10" ref={chartRef}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl tracking-tight">
            Sammenligning — 10 stoerste kommuner
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {data?.metric_name_da ??
              METRICS.find((m) => m.code === selected)?.label}
          </p>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-medium text-[var(--foreground)] sm:w-auto"
        >
          {METRICS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-[var(--text-muted)]">
            Henter data...
          </div>
        ) : data && data.data.length > 0 ? (
          <div ref={containerRef} />
        ) : (
          <div className="flex h-64 items-center justify-center text-[13px] text-[var(--text-muted)]">
            Ingen data tilgaengelig for dette noegletal.
          </div>
        )}
      </div>
    </section>
  );
}
