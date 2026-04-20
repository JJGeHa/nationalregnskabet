"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";

interface Point {
  date: string;
  value: number;
  unit: string;
}

export function BalanceChart({ points }: { points: Point[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    const data = points.map((p) => ({
      date: new Date(p.date),
      value: p.value,
    }));

    const chart = Plot.plot({
      style: {
        fontSize: "14px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      width: 800,
      height: 400,
      x: {
        label: "Year",
        type: "utc",
      },
      y: {
        label: "Mio. DKK",
        grid: true,
        tickFormat: (d: number) => `${(d / 1000).toFixed(0)}B`,
      },
      marks: [
        Plot.ruleY([0], { stroke: "#999", strokeDasharray: "4 2" }),
        Plot.lineY(data, {
          x: "date",
          y: "value",
          stroke: "#2563eb",
          strokeWidth: 2,
        }),
        Plot.dot(data, {
          x: "date",
          y: "value",
          fill: "#2563eb",
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
