import Link from "next/link";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface MetricValue {
  metric_code: string;
  name_da: string;
  unit: string;
  value: number;
  year: number;
  national_avg: number | null;
}

interface KommuneDetail {
  entity_key: string;
  name_da: string;
  name_en: string;
  region: string;
  geo_code: string | null;
  metrics: MetricValue[];
}

function fmtVal(v: number, unit: string): string {
  if (unit === "pct") return `${v.toFixed(2)}%`;
  if (unit === "promille") return `${v.toFixed(1)}\u2030`;
  if (unit === "dkk_per_capita")
    return `${Math.round(v).toLocaleString("da-DK")} kr.`;
  return v.toLocaleString("da-DK", { maximumFractionDigits: 1 });
}

export default async function KommuneDetailPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  let detail: KommuneDetail | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/kommuner/${entity}?year=2026`, {
      cache: "no-store",
    });
    if (!res.ok) {
      error = res.status === 404 ? "Kommune ikke fundet" : `Fejl ${res.status}`;
    } else {
      detail = await res.json();
    }
  } catch {
    error = "Kan ikke naa API'et.";
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <main className="w-full max-w-5xl">
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error ?? "Ikke fundet"}
          </p>
        </main>
      </div>
    );
  }

  // Group metrics by category
  const taxMetrics = detail.metrics.filter((m) =>
    ["kommune_tax_rate", "kommune_church_tax", "kommune_land_tax"].includes(
      m.metric_code,
    ),
  );
  const costMetrics = detail.metrics.filter((m) =>
    [
      "kommune_operating_cost",
      "kommune_service_cost",
      "kommune_health_cost",
      "kommune_education_cost",
    ].includes(m.metric_code),
  );
  const debtMetrics = detail.metrics.filter(
    (m) => m.metric_code === "kommune_debt_per_capita",
  );

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        {/* Breadcrumb */}
        <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Nationalregnskabet
          </Link>
          {" / "}
          <Link href="/kommuner" className="hover:text-[var(--foreground)]">
            Kommuner
          </Link>
          {" / "}
          <span className="text-[var(--foreground)]">{detail.name_da}</span>
        </nav>

        <h1 className="text-3xl tracking-tight sm:text-4xl">
          {detail.name_da}
        </h1>
        <p className="mt-1 text-[15px] text-[var(--text-muted)]">
          {detail.region}
        </p>

        {/* Tax section */}
        {taxMetrics.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl tracking-tight">Skattesatser</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {taxMetrics.map((m) => (
                <MetricCard key={m.metric_code} metric={m} />
              ))}
            </div>
          </section>
        )}

        {/* Cost section */}
        {costMetrics.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl tracking-tight">Udgifter pr. indbygger</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {costMetrics.map((m) => (
                <MetricCard key={m.metric_code} metric={m} />
              ))}
            </div>
          </section>
        )}

        {/* Debt section */}
        {debtMetrics.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl tracking-tight">Gaeld</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {debtMetrics.map((m) => (
                <MetricCard key={m.metric_code} metric={m} />
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-[12px] text-[var(--text-muted)]">
          Kilde: Danmarks Statistik (PSKAT, NGLK) — data fra{" "}
          {detail.metrics[0]?.year ?? ""}
        </p>
      </main>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricValue }) {
  const diff =
    metric.national_avg !== null ? metric.value - metric.national_avg : null;
  const diffPct =
    metric.national_avg && metric.national_avg !== 0 && diff !== null
      ? (diff / metric.national_avg) * 100
      : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {metric.name_da}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">
        {fmtVal(metric.value, metric.unit)}
      </div>
      {metric.national_avg !== null && (
        <div className="mt-2 flex items-center gap-2 text-[13px]">
          <span className="text-[var(--text-muted)]">
            Landsgennemsnit: {fmtVal(metric.national_avg, metric.unit)}
          </span>
          {diffPct !== null && (
            <span
              className={
                Math.abs(diffPct) < 2
                  ? "text-[var(--text-muted)]"
                  : diffPct > 0
                    ? "text-red-600"
                    : "text-emerald-600"
              }
            >
              ({diffPct > 0 ? "+" : ""}
              {diffPct.toFixed(1)}%)
            </span>
          )}
        </div>
      )}
      <div className="mt-1 text-[11px] text-[var(--text-muted)]">
        {metric.year}
      </div>
      {/* Comparison bar */}
      {metric.national_avg !== null && metric.national_avg > 0 && (
        <div className="mt-3">
          <div className="flex gap-1 text-[11px] text-[var(--text-muted)]">
            <span>Kommune</span>
            <span className="ml-auto">Landsgennemsnit</span>
          </div>
          <div className="mt-1 flex gap-1">
            <div
              className="h-1.5 rounded-full bg-[var(--accent-expense)]"
              style={{
                width: `${Math.min((metric.value / (Math.max(metric.value, metric.national_avg) * 1.1)) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex gap-1">
            <div
              className="h-1.5 rounded-full bg-zinc-200"
              style={{
                width: `${Math.min((metric.national_avg / (Math.max(metric.value, metric.national_avg) * 1.1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
