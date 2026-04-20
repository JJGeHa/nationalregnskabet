import { BudgetBarChart, BudgetTimeseriesChart } from "./charts";

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

export default async function FinanslovPage() {
  let overview: FinanslovOverview | null = null;
  let timeseries: FinanslovTimeseries | null = null;
  let error: string | null = null;

  try {
    const [overviewRes, tsRes] = await Promise.all([
      fetch(`${API_URL}/finanslov/overview?year=2024`, {
        cache: "no-store",
      }),
      fetch(`${API_URL}/finanslov/timeseries?entity=STAT&from=2010&to=2024`, {
        cache: "no-store",
      }),
    ]);

    if (!overviewRes.ok) {
      error = `API returned ${overviewRes.status}`;
    } else {
      overview = await overviewRes.json();
    }

    if (tsRes.ok) {
      timeseries = await tsRes.json();
    }
  } catch {
    error = "Could not reach the API. Is the backend running?";
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <main className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Finansloven {overview?.year ?? 2024}
        </h1>
        <p className="mt-2 text-zinc-500">
          Den danske stats budget fordelt efter paragraf (ministerium). Alle tal
          i mio. DKK.
        </p>

        {error ? (
          <p className="mt-8 text-red-600">{error}</p>
        ) : (
          <>
            {overview && overview.paragraffer.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold">Budget pr. paragraf</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Samlet: {(overview.total / 1000).toFixed(1)} mia. DKK
                </p>
                <div className="mt-4">
                  <BudgetBarChart data={overview.paragraffer} />
                </div>
              </div>
            )}

            {timeseries && timeseries.points.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-semibold">Statsbudget over tid</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Sammenligning af finanslovsbevilling og statsregnskab (faktisk
                  forbrug).
                </p>
                <div className="mt-4">
                  <BudgetTimeseriesChart points={timeseries.points} />
                </div>
              </div>
            )}

            <p className="mt-8 text-sm text-zinc-400">
              Kilde: Finansministeriet, oes-cs.dk
            </p>
          </>
        )}
      </main>
    </div>
  );
}
