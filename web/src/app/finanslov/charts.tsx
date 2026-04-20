"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";

interface ParagrafRow {
  entity_key: string;
  name_da: string;
  name_en: string;
  value: number;
}

export function BudgetBarChart({ data }: { data: ParagrafRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Filter to meaningful amounts and sort by absolute value
    const sorted = [...data]
      .filter((d) => Math.abs(d.value) > 100)
      .sort((a, b) => b.value - a.value);

    const chart = Plot.plot({
      style: {
        fontSize: "12px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: 800,
      height: Math.max(400, sorted.length * 28),
      marginLeft: 260,
      x: {
        label: "Mio. DKK",
        grid: true,
        tickFormat: (d: number) =>
          d >= 1000 || d <= -1000
            ? `${(d / 1000).toFixed(0)} mia.`
            : `${d.toFixed(0)}`,
      },
      y: {
        label: null,
      },
      color: {
        domain: [-1, 0, 1],
        range: ["#dc2626", "#999", "#2563eb"],
        interpolate: "rgb",
      },
      marks: [
        Plot.ruleX([0], { stroke: "#ccc" }),
        Plot.barX(sorted, {
          x: "value",
          y: "name_da",
          fill: (d: ParagrafRow) => (d.value >= 0 ? "#2563eb" : "#dc2626"),
          sort: { y: "-x" },
        }),
        Plot.text(
          sorted.filter((d) => d.value >= 0),
          {
            x: "value",
            y: "name_da",
            text: (d: ParagrafRow) =>
              d.value >= 1000
                ? `${(d.value / 1000).toFixed(1)} mia.`
                : `${d.value.toFixed(0)} mio.`,
            dx: 4,
            textAnchor: "start",
            fontSize: 11,
          },
        ),
        Plot.text(
          sorted.filter((d) => d.value < 0),
          {
            x: "value",
            y: "name_da",
            text: (d: ParagrafRow) =>
              d.value <= -1000
                ? `${(d.value / 1000).toFixed(1)} mia.`
                : `${d.value.toFixed(0)} mio.`,
            dx: -4,
            textAnchor: "end",
            fontSize: 11,
          },
        ),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data]);

  return <div ref={containerRef} />;
}

interface TimeseriesPoint {
  year: number;
  appropriation: number | null;
  actual: number | null;
}

export function BudgetTimeseriesChart({
  points,
}: {
  points: TimeseriesPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    // Reshape for Plot: one row per (year, type, value)
    const plotData: { year: number; type: string; value: number }[] = [];
    for (const p of points) {
      if (p.appropriation !== null) {
        plotData.push({
          year: p.year,
          type: "Finanslov",
          value: p.appropriation,
        });
      }
      if (p.actual !== null) {
        plotData.push({
          year: p.year,
          type: "Regnskab",
          value: p.actual,
        });
      }
    }

    const chart = Plot.plot({
      style: {
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: 800,
      height: 400,
      x: { label: "Year", tickFormat: "d" },
      y: {
        label: "Mio. DKK",
        grid: true,
        tickFormat: (d: number) => `${(d / 1000).toFixed(0)} mia.`,
      },
      color: {
        domain: ["Finanslov", "Regnskab"],
        range: ["#2563eb", "#16a34a"],
        legend: true,
      },
      marks: [
        Plot.ruleY([0], { stroke: "#ccc" }),
        Plot.lineY(plotData, {
          x: "year",
          y: "value",
          stroke: "type",
          strokeWidth: 2,
        }),
        Plot.dot(plotData, {
          x: "year",
          y: "value",
          fill: "type",
          r: 3,
        }),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [points]);

  return <div ref={containerRef} />;
}
