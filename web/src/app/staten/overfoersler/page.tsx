import { Breadcrumbs } from "../../../components/breadcrumbs";
import { ErrorBanner } from "../../../components/error-banner";
import { fmtMiaKr, fmtPct } from "../../../lib/format";
import { TransferCharts } from "./charts";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

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

interface TransferTimeseriesPoint {
  year: number;
  bloktilskud: number | null;
  social: number | null;
  other: number | null;
  total: number | null;
}

interface TransferTimeseries {
  points: TransferTimeseriesPoint[];
}

interface BudgetOverview {
  year: number;
  total: number;
}

export default async function OverfoerslerPage() {
  let overview: TransferOverview | null = null;
  let timeseries: TransferTimeseries | null = null;
  let budget: BudgetOverview | null = null;
  let error: string | null = null;

  try {
    const [ovRes, tsRes, budgetRes] = await Promise.all([
      fetch(`${API_URL}/transfers/overview?year=2026`, { cache: "no-store" }),
      fetch(`${API_URL}/transfers/timeseries?from=2010&to=2026`, {
        cache: "no-store",
      }),
      fetch(`${API_URL}/finanslov/treemap?year=2026`, { cache: "no-store" }),
    ]);
    if (ovRes.ok) overview = await ovRes.json();
    if (tsRes.ok) timeseries = await tsRes.json();
    if (budgetRes.ok) budget = await budgetRes.json();
    if (!ovRes.ok) error = `API: ${ovRes.status}`;
  } catch {
    error = "Kan ikke naa API'et.";
  }

  const budgetTotal = budget?.total ?? 0;
  const transferPct =
    budgetTotal > 0 && overview
      ? fmtPct((overview.total / budgetTotal) * 100, 0)
      : null;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Nationalregnskabet" },
            { href: "/staten", label: "Staten" },
            { label: "Overfoersler" },
          ]}
        />

        <div className="animate-fade-up">
          <h1 className="text-3xl tracking-tight sm:text-4xl">
            Overfoersler fra stat til kommuner
          </h1>
          <p className="mt-2 text-[15px] text-[var(--text-muted)]">
            Bloktilskud, sociale pensioner og andre overfoersler fra den danske
            stat til kommuner og regioner. Alle tal er Finanslov{" "}
            {overview?.year ?? 2026} (bevilling).
          </p>
        </div>

        {error && (
          <div className="mt-6">
            <ErrorBanner
              message={error}
              hint="Kontroller at API'et paa localhost:8000 koerer."
            />
          </div>
        )}

        {overview && (
          <>
            <div className="mt-8 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-6 sm:p-8">
              <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Samlet overfoersel — Finanslov {overview.year}
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-[var(--accent-income)]">
                {fmtMiaKr(overview.total)}
              </div>
              {transferPct && (
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                  Det svarer til ca. {transferPct} af det samlede statsbudget.
                </p>
              )}
            </div>

            {/* Breakdown — only finanslov figures */}
            <div className="mt-8 space-y-3">
              {overview.items.map((item) => {
                const pct =
                  overview.total > 0
                    ? (item.finanslov / overview.total) * 100
                    : 0;
                return (
                  <div
                    key={`${item.paragraf_nr}-${item.hovedomraade_nr}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-semibold">
                          {item.label}
                        </h3>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          §{item.paragraf_nr}.{item.hovedomraade_nr}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold tabular-nums text-[var(--accent-income)]">
                          {fmtMiaKr(item.finanslov)}
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          {fmtPct(pct)} af total
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-emerald-50">
                      <div
                        className="h-1.5 rounded-full bg-emerald-400"
                        style={{
                          width: `${(item.finanslov / overview.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {timeseries && timeseries.points.length > 0 && (
          <TransferCharts points={timeseries.points} />
        )}

        <p className="mt-10 text-[12px] text-[var(--text-muted)]">
          Kilde: Finansministeriet, oes-cs.dk — Finanslov{" "}
          {overview?.year ?? 2026}
        </p>
      </main>
    </div>
  );
}
