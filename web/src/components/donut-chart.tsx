"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { fmtMiaKr, fmtPct } from "../lib/format";

interface Slice {
  label: string;
  value: number;
  color?: string;
}

// Refined palette — editorial, muted but distinct
const PALETTE = [
  "#2d4a8a", // deep blue
  "#7c5cbf", // muted purple
  "#c0392b", // brick red
  "#d97706", // amber
  "#0d7c5f", // teal
  "#1e6091", // ocean blue
  "#8e44ad", // rich purple
  "#b45309", // warm brown
  "#16654b", // forest
  "#a63d40", // dusty rose
  "#3a5a9c", // steel blue
  "#6b5b3e", // olive
];

export function DonutChart({
  slices,
  size = 320,
  label,
}: {
  slices: Slice[];
  size?: number;
  label?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string;
    pct: string;
  } | null>(null);

  useEffect(() => {
    if (!svgRef.current || slices.length === 0) return;

    const total = slices.reduce((s, d) => s + Math.abs(d.value), 0);
    const radius = size / 2;
    const inner = radius * 0.58;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("viewBox", `0 0 ${size} ${size}`)
      .attr("width", size)
      .attr("height", size);

    const g = svg
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    const pie = d3
      .pie<Slice>()
      .value((d) => Math.abs(d.value))
      .sort(null)
      .padAngle(0.02);

    const arc = d3
      .arc<d3.PieArcDatum<Slice>>()
      .innerRadius(inner)
      .outerRadius(radius - 4)
      .cornerRadius(2);

    g.selectAll("path")
      .data(pie(slices))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d, i) => d.data.color ?? PALETTE[i % PALETTE.length])
      .attr("stroke", "#fafaf8")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        const pct = (Math.abs(d.data.value) / total) * 100;
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          label: d.data.label,
          value: fmtMiaKr(d.data.value),
          pct: fmtPct(pct),
        });
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("transform", () => {
            const [cx, cy] = arc.centroid(d);
            const angle = Math.atan2(cy, cx);
            return `translate(${Math.cos(angle) * 4},${Math.sin(angle) * 4})`;
          });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) =>
          prev ? { ...prev, x: event.clientX, y: event.clientY } : null,
        );
      })
      .on("mouseleave", (event) => {
        setTooltip(null);
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("transform", "translate(0,0)");
      });

    // Center label
    if (label) {
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.3em")
        .attr("font-size", "12px")
        .attr("fill", "#6b6b7b")
        .text(label);
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.2em")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "#1a1a2e")
        .text(fmtMiaKr(total));
    }
  }, [slices, size, label]);

  return (
    <div className="relative inline-block">
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-medium">{tooltip.label}</div>
          <div className="text-zinc-300">
            {tooltip.value} ({tooltip.pct})
          </div>
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, d) => s + Math.abs(d.value), 0);
  return (
    <div className="space-y-2">
      {slices.map((s, i) => {
        const pct = (Math.abs(s.value) / total) * 100;
        return (
          <div key={s.label} className="flex items-center gap-2.5 text-sm">
            <div
              className="h-3 w-3 rounded-sm flex-shrink-0"
              style={{
                backgroundColor: s.color ?? PALETTE[i % PALETTE.length],
              }}
            />
            <span className="flex-1 truncate text-[13px]">{s.label}</span>
            <span className="font-mono text-[13px] tabular-nums text-[var(--text-muted)]">
              {fmtPct(pct)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
