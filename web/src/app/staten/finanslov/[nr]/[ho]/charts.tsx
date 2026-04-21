"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../../../../hooks/use-container-width";

interface KontoRow {
  hovedkonto_nr: string;
  name: string;
  finanslov: number;
}

function fmtMia(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)} mia.`;
  return `${v.toFixed(0)} mio.`;
}

export function KontoBarChart({
  data,
  color,
}: {
  data: KontoRow[];
  color: string;
}) {
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const sorted = [...data]
      .filter((d) => Math.abs(d.finanslov) > 0.5)
      .sort((a, b) => b.finanslov - a.finanslov);

    if (sorted.length === 0) return;

    const maxLabelLen = Math.max(...sorted.map((d) => d.name.length));
    const leftMargin = Math.min(Math.max(maxLabelLen * 5.5, 100), width * 0.4);

    const chart = Plot.plot({
      style: {
        fontSize: "11px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: Math.max(width - 16, 300),
      height: Math.max(200, sorted.length * 30),
      marginLeft: leftMargin,
      marginRight: 70,
      x: {
        label: null,
        grid: true,
        tickFormat: (d: number) =>
          Math.abs(d) >= 1000
            ? `${(d / 1000).toFixed(0)} mia.`
            : `${d.toFixed(0)}`,
      },
      y: { label: null },
      marks: [
        Plot.ruleX([0], { stroke: "#e2dfda" }),
        Plot.barX(sorted, {
          x: "finanslov",
          y: "name",
          fill: (d: KontoRow) => (d.finanslov >= 0 ? color : "#c0392b"),
          sort: { y: "-x" },
          rx: 2,
        }),
        Plot.text(
          sorted.filter((d) => d.finanslov >= 0),
          {
            x: "finanslov",
            y: "name",
            text: (d: KontoRow) => fmtMia(d.finanslov),
            dx: 5,
            textAnchor: "start",
            fontSize: 10,
            fill: "#6e6b7b",
          },
        ),
        Plot.text(
          sorted.filter((d) => d.finanslov < 0),
          {
            x: "finanslov",
            y: "name",
            text: (d: KontoRow) => fmtMia(d.finanslov),
            dx: -5,
            textAnchor: "end",
            fontSize: 10,
            fill: "#6e6b7b",
          },
        ),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data, color, width, containerRef]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div ref={containerRef} />
    </div>
  );
}
