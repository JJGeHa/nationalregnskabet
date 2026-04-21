import Link from "next/link";
import { ErrorBanner } from "../../components/error-banner";
import { fmtMiaKr } from "../../lib/format";
import { StateCharts } from "./charts";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface TreemapNode {
  name: string;
  paragraf_nr: string;
  value: number;
  category: string;
}

interface TreemapData {
  year: number;
  total: number;
  total_indtaegt: number;
  total_udgift: number;
  total_finansiering: number;
  children: TreemapNode[];
}

interface TransferItem {
  paragraf_nr: string;
  hovedomraade_nr: string;
  label: string;
  finanslov: number;
  regnskab: number | null;
}

interface TransferOverview {
  year: number;
  total: number;
  items: TransferItem[];
}

export default async function StatenPage() {
  let treemap: TreemapData | null = null;
  let transfers: TransferOverview | null = null;
  let error: string | null = null;

  try {
    const [tmRes, trRes] = await Promise.all([
      fetch(`${API_URL}/finanslov/treemap?year=2026`, { cache: "no-store" }),
      fetch(`${API_URL}/transfers/overview?year=2026`, { cache: "no-store" }),
    ]);
    if (tmRes.ok) treemap = await tmRes.json();
    if (trRes.ok) transfers = await trRes.json();
    if (!tmRes.ok) error = `API: ${tmRes.status}`;
  } catch {
    error = "Kan ikke naa API'et.";
  }

  // Only pass actual expenditure items to the donut chart
  const expenseCategories = categorize(
    treemap?.children.filter((c) => c.category === "udgift") ?? [],
  );

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Nationalregnskabet
          </Link>
          {" / "}
          <span className="text-[var(--foreground)]">Staten</span>
        </nav>

        <h1 className="text-3xl tracking-tight sm:text-4xl">Den danske stat</h1>
        <p className="mt-2 text-[15px] text-[var(--text-muted)]">
          Finansloven 2026 — alle tal er bevillingen (budget), ikke regnskab.
        </p>

        {error && (
          <div className="mt-6">
            <ErrorBanner
              message={error}
              hint="Kontroller at API'et paa localhost:8000 koerer."
            />
          </div>
        )}

        {/* Key numbers */}
        {treemap && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-5">
              <div className="text-[12px] font-medium uppercase tracking-wider text-emerald-700">
                Indtaegter
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-800">
                {fmtMiaKr(treemap.total_indtaegt)}
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Skatter, afgifter, renter
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-5">
              <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-expense)]">
                Udgifter
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--accent-expense)]">
                {fmtMiaKr(treemap.total_udgift)}
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Ministerier og offentlig drift
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Finansiering
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">
                {fmtMiaKr(treemap.total_finansiering)}
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Gaeld, renter, genudlaan
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/60 to-white p-5">
              <div className="text-[12px] font-medium uppercase tracking-wider text-amber-700">
                Til kommuner
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-800">
                {transfers ? fmtMiaKr(transfers.total) : "—"}
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Bloktilskud og overfoersler
              </p>
            </div>
          </div>
        )}

        {/* Donut chart — only expenditure */}
        {treemap && (
          <StateCharts
            categories={expenseCategories}
            transfers={transfers?.items ?? []}
          />
        )}

        {/* Quick links */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <Link
            href="/staten/finanslov"
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50"
          >
            <h3 className="font-semibold group-hover:text-[var(--accent-expense)]">
              Finansloven
            </h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Alle paragraffer — bore ned i hovedomraader.
            </p>
          </Link>
          <Link
            href="/staten/overfoersler"
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50"
          >
            <h3 className="font-semibold group-hover:text-emerald-700">
              Overfoersler
            </h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Bloktilskud og tilskud fra stat til kommuner over tid.
            </p>
          </Link>
          <Link
            href="/institutioner/STAT"
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--border)] hover:shadow-lg"
          >
            <h3 className="font-semibold group-hover:text-[var(--foreground)]">
              Institutioner
            </h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Udforsk ministerier og styrelser.
            </p>
          </Link>
        </div>

        <p className="mt-10 text-[12px] text-[var(--text-muted)]">
          Alle tal: Finanslov 2026 (bevilling). Kilde: Finansministeriet,
          oes-cs.dk.
        </p>
      </main>
    </div>
  );
}

interface Category {
  label: string;
  value: number;
}

function categorize(children: TreemapNode[]): Category[] {
  const map: Record<string, string> = {
    "17": "Beskaeftigelse og velfaerd",
    "16": "Sundhed og kommuner",
    "15": "Social og bolig",
    "28": "Transport og infrastruktur",
    "19": "Videregaaende uddannelse",
    "20": "Boern og undervisning",
    "12": "Forsvar",
    "11": "Retsvaaesen",
    "36": "Pensioner",
    "35": "Reserver",
    "09": "Skat (administration)",
    "06": "Udenrigspolitik",
    "07": "Finans og EU",
  };

  const cats: Record<string, number> = {};
  for (const c of children) {
    const label = map[c.paragraf_nr] ?? "Oevrige";
    cats[label] = (cats[label] ?? 0) + c.value;
  }

  return Object.entries(cats)
    .map(([label, value]) => ({ label, value }))
    .filter((c) => c.value > 100)
    .sort((a, b) => b.value - a.value);
}
