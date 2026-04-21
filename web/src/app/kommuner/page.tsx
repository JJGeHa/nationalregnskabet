import Link from "next/link";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { KommuneCompareSection } from "./compare-client";
import { KommuneSearch } from "./search-client";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface KommuneListItem {
  entity_key: string;
  name_da: string;
  region: string;
}

export default async function KommunerPage() {
  let kommuneList: KommuneListItem[] = [];

  try {
    const listRes = await fetch(`${API_URL}/kommuner/list`, {
      cache: "no-store",
    });
    if (listRes.ok) kommuneList = await listRes.json();
  } catch {
    /* ignore */
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Nationalregnskabet" },
            { label: "Kommuner" },
          ]}
        />

        <div className="animate-fade-up">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Kommuner</h1>
          <p className="mt-2 text-[15px] text-[var(--text-muted)]">
            98 danske kommuner — sammenlign noegletal eller udforsk en enkelt
            kommune.
          </p>
        </div>

        {/* Kommune search */}
        {kommuneList.length > 0 && (
          <section className="mt-8">
            <KommuneSearch kommuner={kommuneList} />
          </section>
        )}

        {/* Comparison section with metric selector */}
        <KommuneCompareSection />

        <div className="mt-10">
          <Link
            href="/kort"
            className="text-[13px] font-medium text-amber-700 hover:underline"
          >
            Se kommunedata paa kort →
          </Link>
        </div>

        <p className="mt-10 text-[12px] text-[var(--text-muted)]">
          Kilde: Danmarks Statistik, PSKAT / NGLK
        </p>
      </main>
    </div>
  );
}
