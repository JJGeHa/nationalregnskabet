import { CompareBarChart } from "./charts";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface KommuneRow {
  entity_key: string;
  name_da: string;
  year: number;
  value: number;
}

interface KommuneCompare {
  metric: string;
  metric_name_da: string;
  unit: string;
  data: KommuneRow[];
}

// Top 10 largest kommuner by population for default comparison
const DEFAULT_KOMMUNER = [
  "KOM_0101",
  "KOM_0751",
  "KOM_0461",
  "KOM_0851",
  "KOM_0151",
  "KOM_0615",
  "KOM_0265",
  "KOM_0657",
  "KOM_0630",
  "KOM_0561",
].join(",");

const METRICS = [
  { code: "kommune_tax_rate", label: "Kommuneskat" },
  { code: "kommune_operating_cost", label: "Driftsudgifter pr. indb." },
  { code: "kommune_service_cost", label: "Serviceudgifter pr. indb." },
  { code: "kommune_debt_per_capita", label: "Langfristet gaeld pr. indb." },
  { code: "kommune_health_cost", label: "Sundhedsudgifter pr. indb." },
  { code: "kommune_education_cost", label: "Folkeskoleudgifter pr. elev" },
];

export default async function KommunerPage() {
  const sections: { metric: string; data: KommuneCompare | null }[] = [];

  for (const m of METRICS) {
    try {
      const res = await fetch(
        `${API_URL}/kommuner/compare?metric=${m.code}&entities=${DEFAULT_KOMMUNER}&year=2023`,
        { cache: "no-store" },
      );
      if (res.ok) {
        sections.push({ metric: m.label, data: await res.json() });
      } else {
        sections.push({ metric: m.label, data: null });
      }
    } catch {
      sections.push({ metric: m.label, data: null });
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <main className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Kommunesammenligning
        </h1>
        <p className="mt-2 text-zinc-500">
          Sammenligning af de 10 stoerste kommuner paa udvalgte noegletal
          (2023).
        </p>

        {sections.map((s) => (
          <div key={s.metric} className="mt-10">
            <h2 className="text-xl font-semibold">
              {s.data?.metric_name_da ?? s.metric}
            </h2>
            {s.data && s.data.data.length > 0 ? (
              <div className="mt-4">
                <CompareBarChart data={s.data.data} unit={s.data.unit} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">
                Ingen data tilgaengelig.
              </p>
            )}
          </div>
        ))}

        <p className="mt-8 text-sm text-zinc-400">
          Kilde: Danmarks Statistik, PSKAT / NGLK
        </p>
      </main>
    </div>
  );
}
