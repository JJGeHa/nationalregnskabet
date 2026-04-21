"use client";

import * as Plot from "@observablehq/plot";
import { useEffect } from "react";
import { useContainerWidth } from "../../hooks/use-container-width";
import { fmtDKK, fmtPct, fmtPromille } from "../../lib/format";

interface KommuneRow {
  entity_key: string;
  name_da: string;
  year: number;
  value: number;
}

export function CompareBarChart({
  data,
  unit,
}: {
  data: KommuneRow[];
  unit: string;
}) {
  const { ref: containerRef, width } = useContainerWidth();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const sorted = [...data].sort((a, b) => b.value - a.value);

    const chart = Plot.plot({
      style: {
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width,
      height: Math.max(300, sorted.length * 32),
      marginLeft: Math.min(160, width * 0.25),
      x: {
        label: unit === "pct" ? "%" : unit === "promille" ? "\u2030" : "Kr.",
        grid: true,
      },
      y: { label: null },
      marks: [
        Plot.barX(sorted, {
          x: "value",
          y: "name_da",
          fill: "#2563eb",
          sort: { y: "-x" },
        }),
        Plot.text(sorted, {
          x: "value",
          y: "name_da",
          text: (d: KommuneRow) =>
            unit === "pct"
              ? fmtPct(d.value, 2)
              : unit === "promille"
                ? fmtPromille(d.value, 1)
                : fmtDKK(d.value),
          dx: 4,
          textAnchor: "start",
          fontSize: 11,
        }),
      ],
    });

    containerRef.current.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data, unit, width, containerRef]);

  return <div ref={containerRef} />;
}
