"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../../../hooks/use-container-width";
import { fmtAxisMia, fmtMia } from "../../../../lib/format";

interface HovedområdeRow {
  hovedomraade_nr: string;
  name: string;
  finanslov: number;
  regnskab: number | null;
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
        label: "mio. kr.",
        grid: true,
        tickFormat: fmtAxisMia,
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
        Plot.tip(
          sorted,
          Plot.pointerY({
            x: "finanslov",
            y: "name",
            title: (d: HovedområdeRow) =>
              `${d.name}\n§${d.hovedomraade_nr}\n${fmtMia(d.finanslov)} kr.`,
          }),
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
