"use client";

import { useRouter } from "next/navigation";
import { BudgetTreemap } from "../../treemap";

interface TreemapChild {
  name: string;
  hovedomraade_nr: string;
  value: number;
}

interface TreemapNode {
  name: string;
  paragraf_nr: string;
  value: number;
  category: string;
  children: TreemapChild[];
}

interface TreemapData {
  year: number;
  total: number;
  total_indtaegt: number;
  total_udgift: number;
  total_finansiering: number;
  children: TreemapNode[];
}

export function FinanslovTreemap({ data }: { data: TreemapData }) {
  const router = useRouter();

  const expenseOnly: TreemapData = {
    ...data,
    children: data.children.filter((c) => c.category === "udgift"),
  };

  return (
    <BudgetTreemap
      data={expenseOnly}
      onSelect={(nr) => router.push(`/staten/finanslov/${nr}`)}
    />
  );
}
