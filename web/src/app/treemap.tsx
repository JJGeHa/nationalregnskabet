"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

interface TreemapChild {
  name: string;
  hovedomraade_nr: string;
  value: number;
}

interface TreemapNode {
  name: string;
  paragraf_nr: string;
  value: number;
  children: TreemapChild[];
}

interface TreemapData {
  year: number;
  total: number;
  children: TreemapNode[];
}

// Refined editorial palette
const COLORS = [
  "#2d4a8a",
  "#7c5cbf",
  "#c0392b",
  "#d97706",
  "#0d7c5f",
  "#1e6091",
  "#8e44ad",
  "#b45309",
  "#16654b",
  "#a63d40",
  "#3a5a9c",
  "#6b5b3e",
  "#5b2c6f",
  "#1a5276",
  "#784212",
  "#1b4f72",
];

function fmtMia(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(0)} mia.`;
  if (abs >= 1) return `${v.toFixed(0)} mio.`;
  return `${v.toFixed(1)} mio.`;
}

export function BudgetTreemap({
  data,
  onSelect,
}: {
  data: TreemapData;
  onSelect?: (paragrafNr: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    value: string;
    parent?: string;
  } | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.children.length === 0) return;

    const width = 960;
    const height = 560;

    const expenditure = data.children.filter((c) => c.value > 0);

    const root = d3
      .hierarchy<{ name: string; value?: number; children?: unknown[] }>({
        name: "Budget",
        children: expenditure.map((par, i) => ({
          name: par.name,
          _paragrafNr: par.paragraf_nr,
          _colorIndex: i,
          children: par.children
            .filter((c) => c.value > 0)
            .map((c) => ({
              name: c.name,
              value: c.value,
              _paragrafNr: par.paragraf_nr,
              _parentName: par.name,
              _colorIndex: i,
            })),
        })),
      })
      .sum((d) => (d as { value?: number }).value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    type Datum = { name: string; value?: number; children?: unknown[] };
    type RectNode = d3.HierarchyRectangularNode<Datum>;

    const laid = d3
      .treemap<Datum>()
      .size([width, height])
      .padding(2)
      .paddingTop(22)
      .round(true)(root) as RectNode;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Draw paragraf groups
    const groups = svg
      .selectAll<SVGGElement, RectNode>("g.par")
      .data((laid.children ?? []) as RectNode[])
      .join("g")
      .attr("class", "par");

    // Paragraf background
    groups
      .append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (_, i) => COLORS[i % COLORS.length])
      .attr("fill-opacity", 0.08)
      .attr("rx", 4)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const nr = (d.data as { _paragrafNr?: string })._paragrafNr;
        if (nr && onSelect) onSelect(nr);
      });

    // Paragraf label
    groups
      .append("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 15)
      .text((d) => {
        const w = d.x1 - d.x0;
        const name = d.data.name;
        if (w < 60) return "";
        if (w < 120) return `${name.slice(0, 10)}…`;
        return name;
      })
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", (_, i) => COLORS[i % COLORS.length])
      .attr("opacity", 0.9)
      .style("pointer-events", "none");

    // Draw leaf nodes (hovedområder)
    svg
      .selectAll<SVGRectElement, RectNode>("rect.leaf")
      .data(laid.leaves() as RectNode[])
      .join("rect")
      .attr("class", "leaf")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => {
        const ci = (d.data as { _colorIndex?: number })._colorIndex ?? 0;
        return COLORS[ci % COLORS.length];
      })
      .attr("fill-opacity", 0.75)
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const nr = (d.data as { _paragrafNr?: string })._paragrafNr;
        if (nr && onSelect) onSelect(nr);
      })
      .on("mouseenter", (event, d) => {
        const parentName =
          (d.data as { _parentName?: string })._parentName ?? "";
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          name: d.data.name,
          value: `${fmtMia(d.value ?? 0)} kr.`,
          parent: parentName,
        });
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("fill-opacity", 0.95);
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
          .duration(100)
          .attr("fill-opacity", 0.75);
      });

    // Leaf labels
    svg
      .selectAll<SVGTextElement, RectNode>("text.leaf")
      .data(laid.leaves() as RectNode[])
      .join("text")
      .attr("class", "leaf")
      .attr("x", (d) => d.x0 + 5)
      .attr("y", (d) => d.y0 + (d.y1 - d.y0) / 2 + 3)
      .text((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 50 || h < 20) return "";
        const name = d.data.name;
        const maxChars = Math.floor(w / 6.5);
        return name.length > maxChars
          ? `${name.slice(0, maxChars - 1)}…`
          : name;
      })
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("fill", "white")
      .style("pointer-events", "none");

    // Value labels inside cells
    svg
      .selectAll<SVGTextElement, RectNode>("text.val")
      .data(laid.leaves() as RectNode[])
      .join("text")
      .attr("class", "val")
      .attr("x", (d) => d.x0 + 5)
      .attr("y", (d) => d.y0 + (d.y1 - d.y0) / 2 + 15)
      .text((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 50 || h < 35) return "";
        return fmtMia(d.value ?? 0);
      })
      .attr("font-size", "9px")
      .attr("fill", "rgba(255,255,255,0.75)")
      .style("pointer-events", "none");
  }, [data, onSelect]);

  return (
    <div className="relative">
      <svg ref={svgRef} className="w-full" style={{ maxHeight: "560px" }} />
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          {tooltip.parent && (
            <div className="text-[11px] text-zinc-400">{tooltip.parent}</div>
          )}
          <div className="font-medium">{tooltip.name}</div>
          <div className="text-zinc-300">{tooltip.value}</div>
        </div>
      )}
    </div>
  );
}

export function RevenueSummary({ data }: { data: TreemapData }) {
  const revenue = data.children
    .filter((c) => c.value < 0)
    .sort((a, b) => a.value - b.value);
  const expenditureTotal = data.children
    .filter((c) => c.value > 0)
    .reduce((s, c) => s + c.value, 0);

  if (revenue.length === 0) return null;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="text-[12px] text-[var(--text-muted)]">
          Udgifter i alt
        </div>
        <div className="mt-1 text-2xl font-bold text-[var(--accent-expense)]">
          {fmtMia(expenditureTotal)} kr.
        </div>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="text-[12px] text-[var(--text-muted)]">
          Indtaegter i alt
        </div>
        <div className="mt-1 text-2xl font-bold text-emerald-700">
          {fmtMia(
            Math.abs(
              data.children
                .filter((c) => c.value < 0)
                .reduce((s, c) => s + c.value, 0),
            ),
          )}{" "}
          kr.
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-[12px] text-[var(--text-muted)]">
          Netto (budget)
        </div>
        <div className="mt-1 text-2xl font-bold">{fmtMia(data.total)} kr.</div>
      </div>
    </div>
  );
}
