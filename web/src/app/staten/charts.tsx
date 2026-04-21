"use client";

import { DonutChart, DonutLegend } from "../../components/donut-chart";

interface Category {
  label: string;
  value: number;
}

interface TransferItem {
  paragraf_nr: string;
  hovedomraade_nr: string;
  label: string;
  finanslov: number;
}

function fmtMia(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)} mia.`;
  return `${v.toFixed(0)} mio.`;
}

export function StateCharts({
  categories,
  transfers,
}: {
  categories: Category[];
  transfers: TransferItem[];
}) {
  const expenditure = categories.filter((c) => c.value > 0);
  const transferTotal = transfers.reduce((s, t) => s + t.finanslov, 0);

  return (
    <>
      {/* Expense donut */}
      <section className="mt-12">
        <h2 className="text-2xl tracking-tight">Udgiftsfordeling</h2>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Statens udgifter fordelt paa overordnede kategorier.
        </p>
        <div className="mt-5 flex flex-col items-start gap-8 sm:flex-row">
          <DonutChart
            slices={expenditure.map((c) => ({
              label: c.label,
              value: c.value,
            }))}
            size={300}
            label="Udgifter"
          />
          <div className="flex-1">
            <DonutLegend
              slices={expenditure.map((c) => ({
                label: c.label,
                value: c.value,
              }))}
            />
          </div>
        </div>
      </section>

      {/* Transfers summary */}
      {transfers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl tracking-tight">
            Overfoersler til kommuner og regioner
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            I alt {fmtMia(transferTotal)} kr. overfoeres fra staten til kommuner
            og regioner.
          </p>
          <div className="mt-5 space-y-3">
            {transfers.map((t) => {
              const pct =
                transferTotal > 0
                  ? ((t.finanslov / transferTotal) * 100).toFixed(1)
                  : "0";
              return (
                <div
                  key={`${t.paragraf_nr}-${t.hovedomraade_nr}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[15px] font-medium">{t.label}</div>
                      <div className="text-[12px] text-[var(--text-muted)]">
                        §{t.paragraf_nr}.{t.hovedomraade_nr}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-semibold tabular-nums text-[var(--accent-income)]">
                        {fmtMia(t.finanslov)} kr.
                      </div>
                      <div className="text-[12px] text-[var(--text-muted)]">
                        {pct}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-emerald-50">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400"
                      style={{
                        width: `${(t.finanslov / transferTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
