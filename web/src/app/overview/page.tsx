import { BalanceChart } from "./chart";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface Point {
  date: string;
  value: number;
  unit: string;
}

interface TimeseriesResponse {
  metric: string;
  entity: string;
  points: Point[];
}

export default async function OverviewPage() {
  let data: TimeseriesResponse | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(
      `${API_URL}/timeseries?metric=public_balance&entity=STAT&from=1990-01-01&to=2025-01-01`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      error = `API returned ${res.status}`;
    } else {
      data = await res.json();
    }
  } catch {
    error = "Could not reach the API. Is the backend running?";
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <main className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Danish Public Sector Balance
        </h1>
        <p className="mt-2 text-zinc-500">
          Net fiscal balance of the Danish public sector (stat, kommuner,
          regioner) in millions of DKK.
        </p>

        {error ? (
          <p className="mt-8 text-red-600">{error}</p>
        ) : data && data.points.length > 0 ? (
          <div className="mt-8">
            <BalanceChart points={data.points} />
            <p className="mt-4 text-sm text-zinc-400">
              Kilde: Danmarks Statistik, OFF3
            </p>
          </div>
        ) : (
          <p className="mt-8 text-zinc-500">No data available.</p>
        )}
      </main>
    </div>
  );
}
