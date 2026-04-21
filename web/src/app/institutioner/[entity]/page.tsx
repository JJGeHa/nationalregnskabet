import Link from "next/link";
import { ErrorBanner } from "../../../components/error-banner";
import { fmtMiaKr } from "../../../lib/format";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface InstitutionSummary {
  entity_key: string;
  name_da: string;
  inst_type: string;
  budget: number | null;
}

interface InstitutionDetail {
  entity_key: string;
  name_da: string;
  name_en: string;
  inst_type: string;
  parent_entity_key: string | null;
  sector_esa2010: string | null;
  budget: number | null;
  budget_actual: number | null;
  children: InstitutionSummary[];
}

interface ParentInfo {
  entity_key: string;
  name_da: string;
}

const TYPE_LABELS: Record<string, string> = {
  stat: "Staten",
  ministerium: "Ministerium",
  styrelse: "Styrelse",
  paragraf: "Finanslovsparagraf",
  region: "Region",
  kommune: "Kommune",
};

export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  let detail: InstitutionDetail | null = null;
  let parent: ParentInfo | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/institutions/${entity}?year=2026`, {
      cache: "no-store",
    });
    if (!res.ok) {
      error =
        res.status === 404 ? "Institution ikke fundet" : `Fejl ${res.status}`;
    } else {
      detail = await res.json();
    }

    // Fetch parent name if available
    if (detail?.parent_entity_key) {
      const parentRes = await fetch(
        `${API_URL}/institutions/${detail.parent_entity_key}?year=2026`,
        { cache: "no-store" },
      );
      if (parentRes.ok) {
        const parentData = await parentRes.json();
        parent = {
          entity_key: parentData.entity_key,
          name_da: parentData.name_da,
        };
      }
    }
  } catch {
    error = "Kan ikke naa API'et.";
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <main className="w-full max-w-5xl">
          <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
            <Link href="/staten" className="hover:text-[var(--foreground)]">
              &larr; Tilbage til Staten
            </Link>
          </nav>
          <ErrorBanner
            title="Institution ikke fundet"
            message={error ?? "Ikke fundet"}
            hint={`Id '${entity}' matcher ingen institution i 2026.`}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        {/* Breadcrumb */}
        <nav className="mb-6 text-[13px] text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Nationalregnskabet
          </Link>
          {" / "}
          <Link href="/staten" className="hover:text-[var(--foreground)]">
            Staten
          </Link>
          {parent && (
            <>
              {" / "}
              <Link
                href={`/institutioner/${parent.entity_key}`}
                className="hover:text-[var(--foreground)]"
              >
                {parent.name_da}
              </Link>
            </>
          )}
          {" / "}
          <span className="text-[var(--foreground)]">{detail.name_da}</span>
        </nav>

        <h1 className="text-3xl tracking-tight sm:text-4xl">
          {detail.name_da}
        </h1>
        <p className="mt-1 text-[15px] text-[var(--text-muted)]">
          {detail.name_en}
        </p>

        {/* Metadata */}
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Type
            </div>
            <div className="text-[15px] font-medium">
              {TYPE_LABELS[detail.inst_type] ?? detail.inst_type}
            </div>
          </div>
          {detail.sector_esa2010 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                ESA 2010 sektor
              </div>
              <div className="text-[15px] font-medium">
                {detail.sector_esa2010}
              </div>
            </div>
          )}
          {detail.budget !== null && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                Finanslov 2026
              </div>
              <div className="text-lg font-bold text-[var(--accent-expense)]">
                {fmtMiaKr(detail.budget)}
              </div>
            </div>
          )}
          {detail.budget_actual !== null && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                Regnskab 2022
              </div>
              <div className="text-lg font-bold text-[var(--accent-income)]">
                {fmtMiaKr(detail.budget_actual)}
              </div>
            </div>
          )}
          {detail.entity_key !== "STAT" && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                Identifikation
              </div>
              <div className="font-mono text-[13px]">{detail.entity_key}</div>
            </div>
          )}
        </div>

        {/* Children */}
        {detail.children.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl tracking-tight">Under {detail.name_da}</h2>
            <div className="mt-5 space-y-2">
              {detail.children.map((child) => (
                <Link
                  key={child.entity_key}
                  href={`/institutioner/${child.entity_key}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div>
                    <div className="text-[15px] font-medium">
                      {child.name_da}
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      {TYPE_LABELS[child.inst_type] ?? child.inst_type}
                    </div>
                  </div>
                  {child.budget !== null && (
                    <div className="text-right font-mono text-[13px] tabular-nums text-[var(--accent-expense)]">
                      {fmtMiaKr(child.budget)}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-[12px] text-[var(--text-muted)]">
          Kilde: Finansministeriet, Danmarks Statistik
        </p>
      </main>
    </div>
  );
}
