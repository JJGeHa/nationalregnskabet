import { Breadcrumbs } from "../../components/breadcrumbs";
import { KommuneMap } from "./map-client";

export default function KortPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Nationalregnskabet" },
            { label: "Kort" },
          ]}
        />

        <div className="animate-fade-up">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Kommunekort</h1>
          <p className="mt-2 text-[15px] text-[var(--text-muted)]">
            Vaelg et noegletal for at farvelaegge kortet. Klik paa en kommune
            for detaljer.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm">
          <KommuneMap />
        </div>

        <p className="mt-5 text-[12px] text-[var(--text-muted)]">
          Kilde: Danmarks Statistik, PSKAT / NGLK. Kommunegraenser:
          Dataforsyningen (DAWA).
        </p>
      </main>
    </div>
  );
}
