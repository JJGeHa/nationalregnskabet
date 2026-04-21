import Link from "next/link";
import { Breadcrumbs } from "../../../../../components/breadcrumbs";
import { ErrorBanner } from "../../../../../components/error-banner";
import { fmtMia, fmtMiaKr, fmtPct } from "../../../../../lib/format";
import { KontoBarChart } from "./charts";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface KontoRow {
  hovedkonto_nr: string;
  name: string;
  finanslov: number;
}

interface HovedområdeDetail {
  paragraf_nr: string;
  paragraf_name: string;
  hovedomraade_nr: string;
  hovedomraade_name: string;
  year: number;
  total_finanslov: number;
  konti: KontoRow[];
}

const CATEGORY: Record<string, string> = {
  "38": "indtaegt",
  "42": "finansiering",
  "40": "finansiering",
  "37": "finansiering",
  "41": "finansiering",
};

const REQUESTED_YEAR = 2026;

export default async function HovedområdePage({
  params,
}: {
  params: Promise<{ nr: string; ho: string }>;
}) {
  const { nr, ho } = await params;
  let detail: HovedområdeDetail | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(
      `${API_URL}/finanslov/paragraf/${nr}/hovedomraade/${ho}?year=2026`,
      { cache: "no-store" },
    );
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
              href={`/staten/finanslov/${nr}`}
              className="hover:text-[var(--foreground)]"
            >
              &larr; Tilbage til paragraffen
            </Link>
          </nav>
          <ErrorBanner
            title="Hovedomraade ikke fundet"
            message={error ?? "Ikke fundet"}
            hint={`§${nr}.${ho} findes maaske ikke.`}
          />
        </main>
      </div>
    );
  }

  const cat = CATEGORY[detail.paragraf_nr] ?? "udgift";
  const isIncome = cat === "indtaegt";
  const accentColor = isIncome ? "#0d7c5f" : "#2d4a8a";
  const accentVar = isIncome ? "var(--accent-income)" : "var(--accent-expense)";
  const hoverBg = isIncome
    ? "hover:bg-[var(--accent-income-muted)]"
    : "hover:bg-[var(--accent-expense-muted)]";

  const positiveKonti = detail.konti
    .filter((k) => k.finanslov > 0.5)
    .sort((a, b) => b.finanslov - a.finanslov);
  const negativeKonti = detail.konti
    .filter((k) => k.finanslov < -0.5)
    .sort((a, b) => a.finanslov - b.finanslov);
  const totalPositive = positiveKonti.reduce((s, k) => s + k.finanslov, 0);

  // Known tax expenditures
  const TAX_EXPENDITURE_KONTI = new Set(["381201", "381501", "381502"]);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Nationalregnskabet" },
            { href: "/staten", label: "Staten" },
            { href: "/staten/finanslov", label: "Finansloven" },
            {
              href: `/staten/finanslov/${detail.paragraf_nr}`,
              label: `§${detail.paragraf_nr}`,
            },
            { label: detail.hovedomraade_name },
          ]}
        />

        <div className="animate-fade-up">
          <h1 className="text-3xl tracking-tight sm:text-4xl">
            {detail.hovedomraade_name}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            &sect;{detail.paragraf_nr}.{detail.hovedomraade_nr} under{" "}
            {detail.paragraf_name} &mdash; Finanslov {detail.year}
          </p>
          {detail.year !== REQUESTED_YEAR && detail.konti.length > 0 && (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              Konto-opdeling er kun tilgaengelig til og med {detail.year}.
            </p>
          )}
          {detail.konti.length === 0 && (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              Der findes ingen konto-opdeling for §{detail.paragraf_nr}.
              {detail.hovedomraade_nr}. Gaa tilbage til{" "}
              <Link
                href={`/staten/finanslov/${detail.paragraf_nr}`}
                className="underline hover:text-[var(--foreground)]"
              >
                §{detail.paragraf_nr}
              </Link>{" "}
              for en liste over tilgaengelige hovedomraader.
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isIncome ? "Indtaegt" : "Bevilling"}
            </div>
            <div
              className="mt-1 text-2xl font-bold tracking-tight"
              style={{ color: accentVar }}
            >
              {fmtMiaKr(detail.total_finanslov)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Budgetposter
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              {detail.konti.length}
            </div>
          </div>
          {negativeKonti.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Fradrag
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-red-700">
                {fmtMia(negativeKonti.reduce((s, k) => s + k.finanslov, 0))}
              </div>
            </div>
          )}
        </div>

        {/* Tax expenditure note */}
        {isIncome &&
          positiveKonti.some((k) =>
            TAX_EXPENDITURE_KONTI.has(k.hovedkonto_nr),
          ) && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-amber-900">
                <span className="font-semibold">Bemaerk:</span> Denne post
                indeholder baade skatteindtaegter og skatteudgifter — ydelser
                som Boerne- og ungeydelsen, der udbetales via skattesystemet.
              </p>
            </div>
          )}

        {/* Bar chart */}
        {positiveKonti.length > 1 && (
          <section className="mt-8">
            <KontoBarChart data={detail.konti} color={accentColor} />
          </section>
        )}

        {/* Table: positive items */}
        {positiveKonti.length > 0 && (
          <section className="mt-6">
            <div className="rule-top">
              <h2 className="text-xl tracking-tight">Konti</h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Konto
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Navn
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Bevilling
                    </th>
                    <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:table-cell">
                      Andel
                    </th>
                    <th className="hidden w-24 px-4 py-2.5 md:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {positiveKonti.map((konto) => {
                    const pct =
                      totalPositive > 0
                        ? (konto.finanslov / totalPositive) * 100
                        : 0;
                    const isTaxExp = TAX_EXPENDITURE_KONTI.has(
                      konto.hovedkonto_nr,
                    );
                    return (
                      <tr
                        key={konto.hovedkonto_nr}
                        className={`border-b border-[var(--border-subtle)] transition ${isTaxExp ? "bg-amber-50/40" : "bg-[var(--surface)]"} ${hoverBg}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                          {konto.hovedkonto_nr}
                        </td>
                        <td className="px-4 py-2.5 text-[13px]">
                          {konto.name}
                          {isTaxExp && (
                            <span className="ml-2 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700">
                              Skatteudgift
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums"
                          style={{ color: accentVar }}
                        >
                          {fmtMia(konto.finanslov)}
                        </td>
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
        {negativeKonti.length > 0 && (
          <section className="mt-8">
            <div className="rule-top-thin">
              <h2 className="text-lg tracking-tight text-[var(--text-muted)]">
                Fradrag og tilbagefoersler
              </h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-left">
                <tbody>
                  {negativeKonti.map((konto) => (
                    <tr
                      key={konto.hovedkonto_nr}
                      className="border-b border-[var(--border-subtle)] bg-[var(--surface)]"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {konto.hovedkonto_nr}
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">{konto.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums text-red-700">
                        {fmtMia(konto.finanslov)}
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
