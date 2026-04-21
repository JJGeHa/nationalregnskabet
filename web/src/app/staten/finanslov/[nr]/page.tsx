import Link from "next/link";
import { ErrorBanner } from "../../../../components/error-banner";
import { fmtMia, fmtMiaKr, fmtPct } from "../../../../lib/format";
import { ParagrafCharts } from "./charts";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface HovedområdeRow {
  hovedomraade_nr: string;
  name: string;
  finanslov: number;
  regnskab: number | null;
}

interface ParagrafDetail {
  paragraf_nr: string;
  paragraf_name: string;
  year: number;
  total_finanslov: number;
  total_regnskab: number | null;
  hovedomraader: HovedområdeRow[];
}

const CATEGORY: Record<string, string> = {
  "38": "indtaegt",
  "42": "finansiering",
  "40": "finansiering",
  "37": "finansiering",
  "41": "finansiering",
};

export default async function ParagrafPage({
  params,
}: {
  params: Promise<{ nr: string }>;
}) {
  const { nr } = await params;
  let detail: ParagrafDetail | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/finanslov/paragraf/${nr}?year=2026`, {
      cache: "no-store",
    });
    if (!res.ok) {
      error = `API returned ${res.status}`;
    } else {
      detail = await res.json();
    }
  } catch {
    error = "Could not reach the API.";
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <main className="w-full max-w-5xl">
          <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
            <Link
              href="/staten/finanslov"
              className="hover:text-[var(--foreground)]"
            >
              &larr; Tilbage til finansloven
            </Link>
          </nav>
          <ErrorBanner
            title="Paragraf ikke fundet"
            message={error ?? "Ikke fundet"}
            hint={`Proev at gaa tilbage til oversigten. Paragraf ${nr} findes maaske ikke for 2026.`}
          />
        </main>
      </div>
    );
  }

  const cat = CATEGORY[detail.paragraf_nr] ?? "udgift";
  const isIncome = cat === "indtaegt";
  const isFinancing = cat === "finansiering";
  const accentColor = isIncome
    ? "var(--accent-income)"
    : isFinancing
      ? "var(--foreground)"
      : "var(--accent-expense)";
  const accentBg = isIncome
    ? "bg-[var(--accent-income-muted)]"
    : isFinancing
      ? "bg-[var(--background)]"
      : "bg-[var(--accent-expense-muted)]";
  const hoverBg = isIncome
    ? "hover:bg-[var(--accent-income-muted)]"
    : isFinancing
      ? "hover:bg-[var(--background)]"
      : "hover:bg-[var(--accent-expense-muted)]";

  const positiveItems = detail.hovedomraader
    .filter((ho) => ho.finanslov > 0.5)
    .sort((a, b) => b.finanslov - a.finanslov);
  const negativeItems = detail.hovedomraader
    .filter((ho) => ho.finanslov < -0.5)
    .sort((a, b) => a.finanslov - b.finanslov);
  const totalPositive = positiveItems.reduce((s, h) => s + h.finanslov, 0);

  const hasRegnskab =
    detail.total_regnskab !== null && detail.total_regnskab !== 0;
  const regnskabDiff =
    hasRegnskab && detail.total_regnskab
      ? detail.total_regnskab - detail.total_finanslov
      : null;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Hjem
          </Link>
          {" / "}
          <Link href="/staten" className="hover:text-[var(--foreground)]">
            Staten
          </Link>
          {" / "}
          <Link
            href="/staten/finanslov"
            className="hover:text-[var(--foreground)]"
          >
            Finansloven
          </Link>
          {" / "}
          <span className="text-[var(--foreground)]">
            &sect;{detail.paragraf_nr}
          </span>
        </nav>

        <h1 className="text-3xl tracking-tight sm:text-4xl">
          {detail.paragraf_name}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          &sect;{detail.paragraf_nr} &mdash; Finansloven {detail.year}
        </p>

        {/* ─── SUMMARY CARDS ─── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            className={`rounded-xl border border-[var(--border)] p-4 ${accentBg}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isIncome ? "Indtaegt" : "Bevilling"}
            </div>
            <div
              className="mt-1 text-2xl font-bold tracking-tight"
              style={{ color: accentColor }}
            >
              {fmtMiaKr(detail.total_finanslov)}
            </div>
          </div>

          {hasRegnskab && detail.total_regnskab !== null && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Regnskab
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                {fmtMiaKr(detail.total_regnskab)}
              </div>
              {regnskabDiff !== null && (
                <div
                  className={`mt-0.5 text-[11px] font-medium ${regnskabDiff > 0 ? "text-red-600" : "text-[var(--accent-income)]"}`}
                >
                  {regnskabDiff > 0 ? "+" : ""}
                  {fmtMia(regnskabDiff)} vs. bevilling
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Hovedomraader
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              {detail.hovedomraader.length}
            </div>
          </div>
        </div>

        {/* ─── CHART + TABLE ─── */}
        {positiveItems.length > 0 && (
          <section className="mt-10">
            <div className="rule-top">
              <h2 className="text-xl tracking-tight">
                Fordeling paa hovedomraader
              </h2>
            </div>

            {/* Chart — only show if multiple items */}
            {positiveItems.length > 1 && (
              <div className="mt-5">
                <ParagrafCharts data={detail.hovedomraader} />
              </div>
            )}

            {/* Table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Nr.
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Hovedomraade
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Bevilling
                    </th>
                    {hasRegnskab && (
                      <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:table-cell">
                        Regnskab
                      </th>
                    )}
                    <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:table-cell">
                      Andel
                    </th>
                    <th className="hidden w-24 px-4 py-2.5 md:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {positiveItems.map((ho) => {
                    const pct =
                      totalPositive > 0
                        ? (ho.finanslov / totalPositive) * 100
                        : 0;
                    return (
                      <tr
                        key={ho.hovedomraade_nr}
                        className={`group border-b border-[var(--border-subtle)] bg-[var(--surface)] transition ${hoverBg}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--text-muted)]">
                          <Link
                            href={`/staten/finanslov/${detail.paragraf_nr}/${ho.hovedomraade_nr}`}
                          >
                            {ho.hovedomraade_nr}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/staten/finanslov/${detail.paragraf_nr}/${ho.hovedomraade_nr}`}
                            className="text-[13px] font-medium"
                            style={{
                              color: "inherit",
                            }}
                          >
                            {ho.name}
                          </Link>
                        </td>
                        <td
                          className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums"
                          style={{ color: accentColor }}
                        >
                          {fmtMia(ho.finanslov)}
                        </td>
                        {hasRegnskab && (
                          <td className="hidden px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-[var(--text-muted)] sm:table-cell">
                            {ho.regnskab !== null ? fmtMia(ho.regnskab) : "—"}
                          </td>
                        )}
                        <td className="hidden px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-[var(--text-muted)] sm:table-cell">
                          {fmtPct(pct)}
                        </td>
                        <td className="hidden px-4 py-2.5 md:table-cell">
                          <div className="h-[4px] w-full rounded-full bg-[var(--border-subtle)]">
                            <div
                              className="h-[4px] rounded-full"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: accentColor,
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
            </div>
          </section>
        )}

        {/* Negative items */}
        {negativeItems.length > 0 && (
          <section className="mt-10">
            <div className="rule-top-thin">
              <h2 className="text-lg tracking-tight text-[var(--text-muted)]">
                Fradrag og tilbagefoersler
              </h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-left">
                <tbody>
                  {negativeItems.map((ho) => (
                    <tr
                      key={ho.hovedomraade_nr}
                      className="border-b border-[var(--border-subtle)] bg-[var(--surface)]"
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--text-muted)]">
                        {ho.hovedomraade_nr}
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">{ho.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums text-red-700">
                        {fmtMia(ho.finanslov)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="mt-10 text-[11px] text-[var(--text-caption)]">
          Kilde: Finansministeriet, oes-cs.dk &mdash; Finanslov {detail.year}
        </p>
      </main>
    </div>
  );
}
