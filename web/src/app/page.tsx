import Link from "next/link";
import { HomeTreemap } from "./home-client";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

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

function fmtMia(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)} mia.`;
  return `${v.toFixed(0)} mio.`;
}

const POPULATION = 6_000_000;

function perPerson(mio: number): string {
  const kr = (mio * 1_000_000) / POPULATION;
  return `${Math.round(kr).toLocaleString("da-DK")} kr.`;
}

export default async function Home() {
  let treemap: TreemapData | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/finanslov/treemap?year=2026`, {
      cache: "no-store",
    });
    if (res.ok) treemap = await res.json();
    else error = `API: ${res.status}`;
  } catch {
    error = "Kan ikke naa API'et. Koerer backend?";
  }

  const income = treemap?.total_indtaegt ?? 0;
  const expenditure = treemap?.total_udgift ?? 0;
  const financing = treemap?.total_finansiering ?? 0;
  const netBalance = income - expenditure + financing;

  const expenses =
    treemap?.children
      .filter((c) => c.category === "udgift")
      .sort((a, b) => b.value - a.value) ?? [];
  const incomeItems =
    treemap?.children
      .filter((c) => c.category === "indtaegt")
      .sort((a, b) => b.value - a.value) ?? [];
  const financingItems =
    treemap?.children
      .filter((c) => c.category === "finansiering")
      .sort((a, b) => b.value - a.value) ?? [];

  const topExpenses = expenses.slice(0, 8);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <main className="w-full max-w-6xl">
        {/* ─── HERO ─── */}
        <div className="mb-12 animate-fade-up sm:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-bar)]">
            Nationalregnskabet
          </p>
          <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1] tracking-tight">
            Den danske offentlige oekonomi
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--text-muted)]">
            Udforsk finansloven, sammenlign kommuner, og foelg pengestroemme fra
            stat til borger. Data fra Finansministeriet, Danmarks Statistik og
            Nationalbanken.
          </p>
        </div>

        {error && (
          <p className="mb-8 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-[13px] text-red-700">
            {error}
          </p>
        )}

        {treemap && (
          <>
            {/* ─── KEY FIGURES ─── */}
            <section className="mb-10 animate-fade-up delay-1">
              <div className="rule-top mb-5">
                <div className="flex items-end justify-between">
                  <h2 className="text-2xl tracking-tight">Finansloven 2026</h2>
                  <Link
                    href="/staten/finanslov"
                    className="text-[13px] font-medium text-[var(--accent-expense)] hover:underline"
                  >
                    Fuld oversigt &rarr;
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-xl border border-emerald-200/60 bg-[var(--accent-income-muted)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-income)]">
                    Indtaegter
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-[var(--accent-income)] sm:text-2xl">
                    {fmtMia(income)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                    {perPerson(income)} / person
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/60 bg-[var(--accent-expense-muted)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-expense)]">
                    Udgifter
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-[var(--accent-expense)] sm:text-2xl">
                    {fmtMia(expenditure)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                    {perPerson(expenditure)} / person
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Finansiering
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                    {fmtMia(financing)}
                  </div>
                </div>
                <div
                  className={`rounded-xl border p-4 ${netBalance >= 0 ? "border-emerald-200/60 bg-emerald-50/40" : "border-red-200/60 bg-red-50/40"}`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Netto
                  </div>
                  <div
                    className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${netBalance >= 0 ? "text-[var(--accent-income)]" : "text-red-700"}`}
                  >
                    {fmtMia(netBalance)}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Paragraffer
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                    {treemap.children.length}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    ministerier og poster
                  </div>
                </div>
              </div>
            </section>

            {/* ─── TREEMAP ─── */}
            <section className="mb-10 animate-fade-up delay-2">
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)]">
                <HomeTreemap data={treemap} />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--text-caption)]">
                Udgiftsfordeling. Arealet svarer til bevillingens stoerrelse.
                Klik for detaljer.
              </p>
            </section>

            {/* ─── THREE-COLUMN: EXPENSES / INCOME / FINANCING ─── */}
            <section className="mb-14 animate-fade-up delay-3">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Top expenses */}
                <div className="lg:col-span-2">
                  <div className="rule-top mb-3">
                    <h3 className="text-lg font-semibold tracking-tight">
                      Stoerste udgiftsomraader
                    </h3>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            &sect;
                          </th>
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Paragraf
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Bevilling
                          </th>
                          <th className="hidden px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:table-cell">
                            Andel
                          </th>
                          <th className="hidden w-20 px-3 py-2 sm:table-cell" />
                        </tr>
                      </thead>
                      <tbody>
                        {topExpenses.map((par) => {
                          const pct = (par.value / expenditure) * 100;
                          return (
                            <tr
                              key={par.paragraf_nr}
                              className="group border-b border-[var(--border-subtle)] bg-[var(--surface)] transition hover:bg-[var(--accent-expense-muted)]"
                            >
                              <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]">
                                <Link
                                  href={`/staten/finanslov/${par.paragraf_nr}`}
                                >
                                  {par.paragraf_nr}
                                </Link>
                              </td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/staten/finanslov/${par.paragraf_nr}`}
                                  className="text-[13px] font-medium group-hover:text-[var(--accent-expense)]"
                                >
                                  {par.name}
                                </Link>
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-[var(--accent-expense)]">
                                {fmtMia(par.value)}
                              </td>
                              <td className="hidden px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--text-muted)] sm:table-cell">
                                {pct.toFixed(1)}%
                              </td>
                              <td className="hidden px-3 py-2 sm:table-cell">
                                <div className="h-[4px] w-full rounded-full bg-[var(--border-subtle)]">
                                  <div
                                    className="h-[4px] rounded-full bg-[var(--accent-expense)]"
                                    style={{
                                      width: `${Math.min(pct, 100)}%`,
                                      opacity: 0.5,
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {expenses.length > topExpenses.length && (
                      <div className="border-t border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2">
                        <Link
                          href="/staten/finanslov"
                          className="text-[12px] font-medium text-[var(--accent-expense)] hover:underline"
                        >
                          Se alle {expenses.length} udgiftsparagraffer &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Income + Financing column */}
                <div className="space-y-6">
                  {/* Income */}
                  <div>
                    <div className="rule-top mb-3">
                      <h3 className="text-lg font-semibold tracking-tight">
                        Indtaegter
                      </h3>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      {incomeItems.map((par) => (
                        <Link
                          key={par.paragraf_nr}
                          href={`/staten/finanslov/${par.paragraf_nr}`}
                          className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 transition last:border-b-0 hover:bg-[var(--accent-income-muted)]"
                        >
                          <div>
                            <div className="text-[13px] font-medium">
                              {par.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              &sect;{par.paragraf_nr}
                              {par.children.length > 1 &&
                                ` \u00B7 ${par.children.length} omraader`}
                            </div>
                          </div>
                          <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--accent-income)]">
                            {fmtMia(par.value)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Financing */}
                  <div>
                    <div className="rule-top-thin mb-3">
                      <h3 className="text-lg font-semibold tracking-tight">
                        Finansiering
                      </h3>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      {financingItems.map((par) => (
                        <Link
                          key={par.paragraf_nr}
                          href={`/staten/finanslov/${par.paragraf_nr}`}
                          className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 transition last:border-b-0 hover:bg-[var(--background)]"
                        >
                          <div>
                            <div className="text-[13px] font-medium">
                              {par.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              &sect;{par.paragraf_nr}
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[13px] tabular-nums ${par.value < 0 ? "text-red-700" : ""}`}
                          >
                            {fmtMia(par.value)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ─── PLATFORM SECTIONS ─── */}
        <section className="mb-14 animate-fade-up delay-4">
          <div className="rule-top-thin mb-5">
            <h2 className="text-xl tracking-tight">Udforsk</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/staten/finanslov"
              className="card-hover rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] hover:border-blue-200"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-expense)]">
                Statsbudgettet
              </div>
              <div className="mt-1 text-[15px] font-semibold">Finansloven</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                Alle paragraffer, hovedomraader og konti med historik.
              </p>
            </Link>
            <Link
              href="/kommuner"
              className="card-hover rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] hover:border-amber-200"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-transfer)]">
                Kommuner
              </div>
              <div className="mt-1 text-[15px] font-semibold">98 kommuner</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                Sammenlign skat, gaeld og udgifter paa tvaers.
              </p>
            </Link>
            <Link
              href="/staten/overfoersler"
              className="card-hover rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] hover:border-emerald-200"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-income)]">
                Pengestroemme
              </div>
              <div className="mt-1 text-[15px] font-semibold">Overfoersler</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                Bloktilskud og tilskud fra stat til kommuner.
              </p>
            </Link>
            <Link
              href="/kort"
              className="card-hover rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] hover:border-emerald-200"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Geografi
              </div>
              <div className="mt-1 text-[15px] font-semibold">Danmarkskort</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                Interaktivt kort med kommunale noegletal.
              </p>
            </Link>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="border-t border-[var(--border)] pb-8 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-sm text-[11px] leading-relaxed text-[var(--text-caption)]">
              Alle tal er Finanslov 2026. Kilde: Finansministeriet (oes-cs.dk),
              Danmarks Statistik, Danmarks Nationalbank.
            </p>
            <div className="flex gap-5 text-[11px] text-[var(--text-caption)]">
              <Link
                href="/staten/finanslov"
                className="hover:text-[var(--foreground)]"
              >
                Finansloven
              </Link>
              <Link href="/kommuner" className="hover:text-[var(--foreground)]">
                Kommuner
              </Link>
              <Link href="/kort" className="hover:text-[var(--foreground)]">
                Kort
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
