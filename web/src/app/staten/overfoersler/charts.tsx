"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../../hooks/use-container-width";
import { fmtAxisMia } from "../../../lib/format";

interface TransferPoint {
  year: number;
  bloktilskud: number | null;
  social: number | null;
  other: number | null;
  total: number | null;
}

export function TransferCharts({ points }: { points: TransferPoint[] }) {
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    const plotData: { year: number; type: string; value: number }[] = [];
    for (const p of points) {
      if (p.bloktilskud !== null) {
        plotData.push({
          year: p.year,
          type: "Bloktilskud",
          value: p.bloktilskud,
        });
      }
      if (p.social !== null) {
        plotData.push({
          year: p.year,
          type: "Sociale pensioner mv.",
          value: p.social,
        });
      }
      if (p.other !== null && p.other > 0) {
        plotData.push({
          year: p.year,
          type: "Oevrige tilskud",
          value: p.other,
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
      x: { label: "Aar", tickFormat: "d" },
      y: {
        label: "mia. kr.",
        grid: true,
        tickFormat: fmtAxisMia,
      },
      color: {
        domain: ["Bloktilskud", "Sociale pensioner mv.", "Oevrige tilskud"],
        range: ["#0d7c5f", "#2d4a8a", "#d97706"],
        legend: true,
      },
      marks: [
        Plot.areaY(
          plotData,
          Plot.stackY({
            x: "year",
            y: "value",
            fill: "type",
            order: "sum",
          }),
        ),
        Plot.ruleY([0]),
        Plot.tip(
          plotData,
          Plot.pointerX({
            x: "year",
            y: "value",
            fill: "type",
            title: (d: { year: number; type: string; value: number }) =>
              `${d.year}\n${d.type}\n${fmtAxisMia(d.value)} kr.`,
          }),
        ),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [points, width, containerRef]);

  return (
    <section className="mt-12">
      <h2 className="text-2xl tracking-tight">Udvikling over tid</h2>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Overfoersler fra stat til kommuner og regioner, 2010-2026.
      </p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div ref={containerRef} />
      </div>
    </section>
  );
}
