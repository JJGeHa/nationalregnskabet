import Link from "next/link";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { ErrorBanner } from "../../../components/error-banner";
import { fmtMia, fmtMiaKr, fmtPct } from "../../../lib/format";
import { BudgetBarChart, BudgetTimeseriesChart } from "./charts";
import { FinanslovTreemap } from "./treemap-client";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface ParagrafRow {
  entity_key: string;
  name_da: string;
  name_en: string;
  value: number;
}

interface FinanslovOverview {
  year: number;
  metric: string;
  total: number;
  paragraffer: ParagrafRow[];
}

interface TimeseriesPoint {
  year: number;
  appropriation: number | null;
  actual: number | null;
}

interface FinanslovTimeseries {
  entity_key: string;
  name_da: string;
  points: TimeseriesPoint[];
}

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

interface TreemapResponse {
  year: number;
  total: number;
  total_indtaegt: number;
  total_udgift: number;
  total_finansiering: number;
  children: TreemapNode[];
}

export default async function FinanslovPage() {
  let overview: FinanslovOverview | null = null;
  let timeseries: FinanslovTimeseries | null = null;
  let treemap: TreemapResponse | null = null;
  let error: string | null = null;

  try {
    const [overviewRes, tsRes, tmRes] = await Promise.all([
      fetch(`${API_URL}/finanslov/overview?year=2026`, {
        cache: "no-store",
      }),
      fetch(`${API_URL}/finanslov/timeseries?entity=STAT&from=2010&to=2026`, {
        cache: "no-store",
      }),
      fetch(`${API_URL}/finanslov/treemap?year=2026`, {
        cache: "no-store",
      }),
    ]);

    if (!overviewRes.ok) {
      error = `API returned ${overviewRes.status}`;
    } else {
      overview = await overviewRes.json();
    }

    if (tsRes.ok) timeseries = await tsRes.json();
    if (tmRes.ok) treemap = await tmRes.json();
  } catch {
    error = "Could not reach the API. Is the backend running?";
  }

  // Categorize paragraphs
  const expenses =
    treemap?.children
      .filter((c) => c.category === "udgift")
      .sort((a, b) => b.value - a.value) ?? [];
  const income =
    treemap?.children
      .filter((c) => c.category === "indtaegt")
      .sort((a, b) => b.value - a.value) ?? [];
  const financing =
    treemap?.children
      .filter((c) => c.category === "finansiering")
      .sort((a, b) => b.value - a.value) ?? [];

  const totalIncome = treemap?.total_indtaegt ?? 0;
  const totalExpense = treemap?.total_udgift ?? 0;
  const totalFinancing = treemap?.total_finansiering ?? 0;
  const netBalance = totalIncome - totalExpense + totalFinancing;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Nationalregnskabet" },
            { href: "/staten", label: "Staten" },
            { label: "Finansloven" },
          ]}
        />

        <div className="animate-fade-up">
          <h1 className="text-3xl tracking-tight sm:text-4xl">
            Finansloven {treemap?.year ?? 2026}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)]">
            Den danske stats samlede budget vedtaget af Folketinget. Alle tal i
            mio. DKK.
          </p>
        </div>

        {error ? (
          <div className="mt-8">
            <ErrorBanner
              message={error}
              hint="Kontroller at API'et paa localhost:8000 koerer."
            />
          </div>
        ) : (
          <>
            {/* ─── SUMMARY CARDS ─── */}
            {treemap && (
              <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200/60 bg-[var(--accent-income-muted)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-income)]">
                    Indtaegter
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--accent-income)]">
                    {fmtMia(totalIncome)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {income.length} paragraf
                    {income.length !== 1 ? "fer" : ""}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/60 bg-[var(--accent-expense-muted)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-expense)]">
                    Udgifter
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--accent-expense)]">
                    {fmtMia(totalExpense)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {expenses.length} paragraffer
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Finansiering
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tight">
                    {fmtMia(totalFinancing)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {financing.length} paragraffer
                  </div>
                </div>
                <div
                  className={`rounded-xl border p-4 ${netBalance >= 0 ? "border-emerald-200/60 bg-emerald-50/40" : "border-red-200/60 bg-red-50/40"}`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Nettoresultat
                  </div>
                  <div
                    className={`mt-1 text-2xl font-bold tracking-tight ${netBalance >= 0 ? "text-[var(--accent-income)]" : "text-red-700"}`}
                  >
                    {fmtMia(netBalance)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {netBalance >= 0 ? "Overskud" : "Underskud"}
                  </div>
                </div>
              </div>
            )}

            {/* ─── UDGIFTER ─── */}
            {expenses.length > 0 && (
              <section className="mt-14">
                <div className="rule-top flex items-end justify-between pb-0">
                  <div>
                    <h2 className="text-2xl tracking-tight">Udgifter</h2>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                      {expenses.length} paragraffer — samlet{" "}
                      {fmtMiaKr(totalExpense)}
                    </p>
                  </div>
                </div>

                {/* Treemap */}
                {treemap && (
                  <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                    <FinanslovTreemap data={treemap} />
                  </div>
                )}

                {/* Expense table */}
                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          &sect;
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Paragraf
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Bevilling
                        </th>
                        <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:table-cell">
                          Andel
                        </th>
                        <th className="hidden w-32 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] md:table-cell" />
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((par) => {
                        const pct = (par.value / totalExpense) * 100;
                        return (
                          <tr
                            key={par.paragraf_nr}
                            className="group border-b border-[var(--border-subtle)] bg-[var(--surface)] transition hover:bg-[var(--accent-expense-muted)]"
                          >
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/staten/finanslov/${par.paragraf_nr}`}
                                className="font-mono text-[12px] text-[var(--text-muted)]"
                              >
                                {par.paragraf_nr}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/staten/finanslov/${par.paragraf_nr}`}
                                className="text-[13px] font-medium group-hover:text-[var(--accent-expense)]"
                              >
                                {par.name}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums text-[var(--accent-expense)]">
                              {fmtMia(par.value)}
                            </td>
                            <td className="hidden px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-[var(--text-muted)] sm:table-cell">
                              {fmtPct(pct)}
                            </td>
                            <td className="hidden px-4 py-2.5 md:table-cell">
                              <div className="h-[5px] w-full rounded-full bg-[var(--border-subtle)]">
                                <div
                                  className="h-[5px] rounded-full bg-[var(--accent-expense)]"
                                  style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    opacity: 0.6,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ─── INDTAEGTER ─── */}
            {income.length > 0 && (
              <section className="mt-14">
                <div className="rule-top">
                  <h2 className="text-2xl tracking-tight">Indtaegter</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    Statens indtaegter — samlet {fmtMiaKr(totalIncome)}
                  </p>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          &sect;
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Paragraf
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Indtaegt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {income.map((par) => (
                        <tr
                          key={par.paragraf_nr}
                          className="group border-b border-[var(--border-subtle)] bg-[var(--surface)] transition hover:bg-[var(--accent-income-muted)]"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/staten/finanslov/${par.paragraf_nr}`}
                              className="font-mono text-[12px] text-[var(--text-muted)]"
                            >
                              {par.paragraf_nr}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/staten/finanslov/${par.paragraf_nr}`}
                              className="text-[13px] font-medium group-hover:text-[var(--accent-income)]"
                            >
                              {par.name}
                            </Link>
                            {par.children && par.children.length > 1 && (
                              <span className="ml-2 text-[11px] text-[var(--text-muted)]">
                                {par.children.length} hovedomraader
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums text-[var(--accent-income)]">
                            {fmtMia(par.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Income breakdown detail — show hovedomraader if available */}
                {income.length > 0 &&
                  income[0].children &&
                  income[0].children.length > 1 && (
                    <div className="mt-4 rounded-xl border border-emerald-200/40 bg-[var(--accent-income-muted)] p-4">
                      <div className="text-[12px] font-semibold text-[var(--accent-income)]">
                        Opdeling af &sect;{income[0].paragraf_nr}{" "}
                        {income[0].name}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {income[0].children
                          .sort((a, b) => b.value - a.value)
                          .map((ho) => (
                            <Link
                              key={ho.hovedomraade_nr}
                              href={`/staten/finanslov/${income[0].paragraf_nr}/${ho.hovedomraade_nr}`}
                              className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 transition hover:bg-white"
                            >
                              <span className="text-[13px]">{ho.name}</span>
                              <span className="font-mono text-[12px] tabular-nums text-[var(--accent-income)]">
                                {fmtMia(ho.value)}
                              </span>
                            </Link>
                          ))}
                      </div>
                    </div>
                  )}
              </section>
            )}

            {/* ─── FINANSIERING ─── */}
            {financing.length > 0 && (
              <section className="mt-14">
                <div className="rule-top">
                  <h2 className="text-2xl tracking-tight">Finansiering</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    Gaeldsposter, renter og beholdningsbevaegelser — samlet{" "}
                    {fmtMiaKr(totalFinancing)}
                  </p>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          &sect;
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Paragraf
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Beloeb
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {financing.map((par) => (
                        <tr
                          key={par.paragraf_nr}
                          className="group border-b border-[var(--border-subtle)] bg-[var(--surface)] transition hover:bg-[var(--background)]"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/staten/finanslov/${par.paragraf_nr}`}
                              className="font-mono text-[12px] text-[var(--text-muted)]"
                            >
                              {par.paragraf_nr}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/staten/finanslov/${par.paragraf_nr}`}
                              className="text-[13px] font-medium group-hover:text-[var(--foreground)]"
                            >
                              {par.name}
                            </Link>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono text-[13px] tabular-nums ${par.value < 0 ? "text-red-700" : "text-[var(--foreground)]"}`}
                          >
                            {fmtMia(par.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ─── HISTORIK ─── */}
            <section className="mt-14">
              <div className="rule-top">
                <h2 className="text-2xl tracking-tight">Historisk udvikling</h2>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Statsbudget (bevilling) og regnskab (faktisk forbrug),
                  2010-2026.
                </p>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Timeseries */}
                {timeseries && timeseries.points.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-muted)]">
                      Budget vs. regnskab over tid
                    </h3>
                    <BudgetTimeseriesChart points={timeseries.points} />
                  </div>
                )}

                {/* Bar chart */}
                {overview && overview.paragraffer.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-muted)]">
                      Bevilling pr. paragraf
                    </h3>
                    <BudgetBarChart data={overview.paragraffer} />
                  </div>
                )}
              </div>
            </section>

            <p className="mt-12 text-[11px] text-[var(--text-caption)]">
              Kilde: Finansministeriet, oes-cs.dk — Finanslov{" "}
              {treemap?.year ?? 2026}. Alle beloeb i mio. DKK.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
