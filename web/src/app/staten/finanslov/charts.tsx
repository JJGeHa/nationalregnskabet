"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../../hooks/use-container-width";

interface ParagrafRow {
  entity_key: string;
  name_da: string;
  name_en: string;
  value: number;
}

export function BudgetBarChart({ data }: { data: ParagrafRow[] }) {
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const sorted = [...data]
      .filter((d) => Math.abs(d.value) > 100)
      .sort((a, b) => b.value - a.value);

    // Dynamically compute left margin based on longest label and available width
    const maxLabelLen = Math.max(...sorted.map((d) => d.name_da.length));
    const leftMargin = Math.min(Math.max(maxLabelLen * 6, 120), width * 0.35);

    const chart = Plot.plot({
      style: {
        fontSize: "12px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: Math.max(width - 16, 300),
      height: Math.max(400, sorted.length * 30),
      marginLeft: leftMargin,
      marginRight: 70,
      x: {
        label: null,
        grid: true,
        tickFormat: (d: number) =>
          d >= 1000 || d <= -1000
            ? `${(d / 1000).toFixed(0)} mia.`
            : `${d.toFixed(0)}`,
      },
      y: { label: null },
      marks: [
        Plot.ruleX([0], { stroke: "#e8e6e1" }),
        Plot.barX(sorted, {
          x: "value",
          y: "name_da",
          fill: (d: ParagrafRow) => (d.value >= 0 ? "#2d4a8a" : "#c0392b"),
          sort: { y: "-x" },
          rx: 3,
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
            dx: 5,
            textAnchor: "start",
            fontSize: 11,
            fill: "#6b6b7b",
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
            dx: -5,
            textAnchor: "end",
            fontSize: 11,
            fill: "#6b6b7b",
          },
        ),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data, width, containerRef]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div ref={containerRef} />
    </div>
  );
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
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    const plotData: { year: number; type: string; value: number }[] = [];
    for (const p of points) {
      if (p.appropriation !== null) {
        plotData.push({
          year: p.year,
          type: "Finanslov (bevilling)",
          value: p.appropriation,
        });
      }
      if (p.actual !== null) {
        plotData.push({
          year: p.year,
          type: "Statsregnskab (faktisk)",
          value: p.actual,
        });
      }
    }

    const chart = Plot.plot({
      style: {
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: Math.max(width - 16, 300),
      height: 360,
      marginRight: 20,
      x: { label: null, tickFormat: "d" },
      y: {
        label: null,
        grid: true,
        tickFormat: (d: number) => `${(d / 1000).toFixed(0)} mia.`,
      },
      color: {
        domain: ["Finanslov (bevilling)", "Statsregnskab (faktisk)"],
        range: ["#2d4a8a", "#0d7c5f"],
        legend: true,
      },
      marks: [
        Plot.ruleY([0], { stroke: "#e8e6e1" }),
        Plot.lineY(plotData, {
          x: "year",
          y: "value",
          stroke: "type",
          strokeWidth: 2.5,
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
  }, [points, width, containerRef]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div ref={containerRef} />
    </div>
  );
}
