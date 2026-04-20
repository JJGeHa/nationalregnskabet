"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const sorted = [...data].sort((a, b) => b.value - a.value);

    const chart = Plot.plot({
      style: {
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: 700,
      height: Math.max(300, sorted.length * 32),
      marginLeft: 160,
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
              ? `${d.value.toFixed(2)}%`
              : unit === "promille"
                ? `${d.value.toFixed(1)}\u2030`
                : `${d.value.toLocaleString("da-DK")} kr.`,
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
  }, [data, unit]);

  return <div ref={containerRef} />;
}
