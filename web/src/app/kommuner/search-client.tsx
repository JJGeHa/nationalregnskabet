"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface KommuneListItem {
  entity_key: string;
  name_da: string;
  region: string;
}

export function KommuneSearch({ kommuner }: { kommuner: KommuneListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered =
    query.length > 0
      ? kommuner
          .filter((k) => k.name_da.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10)
      : [];

  return (
    <div className="relative">
      <label
        htmlFor="kommune-search"
        className="text-[13px] font-medium text-[var(--text-muted)]"
      >
        Find din kommune
      </label>
      <input
        id="kommune-search"
        type="text"
        placeholder="Soeg fx Koebenhavn, Aarhus, Odense..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay to allow click on result
          setTimeout(() => setOpen(false), 150);
        }}
        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] placeholder:text-[var(--text-muted)] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      {/* Results dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
          {filtered.map((k) => (
            <button
              type="button"
              key={k.entity_key}
              onMouseDown={() => {
                router.push(`/kommuner/${k.entity_key}`);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-blue-50"
            >
              <span className="text-[14px] font-medium">{k.name_da}</span>
              <span className="text-[12px] text-[var(--text-muted)]">
                {k.region}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg">
          <p className="text-[13px] text-[var(--text-muted)]">
            Ingen kommuner matcher "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
