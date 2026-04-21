"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../../../hooks/use-container-width";

interface HovedområdeRow {
  hovedomraade_nr: string;
  name: string;
  finanslov: number;
  regnskab: number | null;
}

function fmtMia(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)} mia.`;
  return `${v.toFixed(0)} mio.`;
}

export function ParagrafCharts({ data }: { data: HovedområdeRow[] }) {
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const sorted = [...data]
      .filter((d) => d.finanslov > 0.5)
      .sort((a, b) => b.finanslov - a.finanslov);

    if (sorted.length === 0) return;

    // Compute left margin from longest label
    const maxLabelLen = Math.max(...sorted.map((d) => d.name.length));
    const leftMargin = Math.min(Math.max(maxLabelLen * 6, 120), width * 0.4);

    const chart = Plot.plot({
      style: {
        fontSize: "12px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: Math.max(width - 16, 300),
      height: Math.max(250, sorted.length * 36),
      marginLeft: leftMargin,
      marginRight: 70,
      x: {
        label: null,
        grid: true,
        tickFormat: (d: number) =>
          d >= 1000 ? `${(d / 1000).toFixed(0)} mia.` : `${d.toFixed(0)}`,
      },
      y: { label: null },
      marks: [
        Plot.ruleX([0], { stroke: "#e8e6e1" }),
        Plot.barX(sorted, {
          x: "finanslov",
          y: "name",
          fill: "#2d4a8a",
          sort: { y: "-x" },
          rx: 3,
        }),
        Plot.text(sorted, {
          x: "finanslov",
          y: "name",
          text: (d: HovedområdeRow) => fmtMia(d.finanslov),
          dx: 5,
          textAnchor: "start",
          fontSize: 11,
          fill: "#6b6b7b",
        }),
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
