const API_URL = process.env.API_URL ?? "http://localhost:8000";

interface HelloData {
  message: string;
  generated_at: string;
}

export default async function Home() {
  let data: HelloData | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/hello`, { cache: "no-store" });
    if (!res.ok) {
      error = `API returned ${res.status}`;
    } else {
      data = await res.json();
    }
  } catch {
    error = "Could not reach the API. Is the backend running?";
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <main className="flex flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Danish Public Economy Explorer
        </h1>
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : data ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-2xl font-medium">{data.message}</p>
            <p className="mt-2 text-sm text-zinc-500">
              Generated at: {data.generated_at}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
