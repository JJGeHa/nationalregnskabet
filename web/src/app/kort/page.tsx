import { KommuneMap } from "./map-client";

export default function KortPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <main className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Kommunekort</h1>
        <p className="mt-2 text-zinc-500">
          Choropleth-kort over danske kommuner. Vaelg et noegletal for at
          farvelaegge kortet.
        </p>

        <div className="mt-8">
          <KommuneMap />
        </div>

        <p className="mt-4 text-sm text-zinc-400">
          Kilde: Danmarks Statistik, PSKAT / NGLK. Kommunegraenser:
          Dataforsyningen (DAWA).
        </p>
      </main>
    </div>
  );
}
