import Link from "next/link";

const links = [
  {
    href: "/staten",
    label: "Staten",
    children: [
      { href: "/staten/finanslov", label: "Finansloven" },
      { href: "/staten/overfoersler", label: "Overfoersler" },
    ],
  },
  { href: "/kommuner", label: "Kommuner", children: [] },
  { href: "/kort", label: "Kort", children: [] },
];

export function Nav() {
  return (
    <>
      {/* Editorial accent bar */}
      <div className="h-[3px] bg-[var(--accent-bar)]" />

      <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="group flex items-baseline gap-2">
            <span
              className="text-[20px] tracking-tight text-[var(--foreground)]"
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
              }}
            >
              Nationalregnskabet
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-widest text-[var(--text-caption)] sm:inline">
              DK
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map((l) => (
              <div key={l.href} className="group relative">
                <Link
                  href={l.href}
                  className="relative rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
                >
                  {l.label}
                </Link>
                {l.children.length > 0 && (
                  <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg shadow-black/5">
                      {l.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className="block whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-[var(--text-muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
