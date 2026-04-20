import Link from "next/link";

const links = [
  { href: "/overview", label: "Overblik" },
  { href: "/finanslov", label: "Finanslov" },
  { href: "/kommuner", label: "Kommuner" },
  { href: "/kort", label: "Kort" },
];

export function Nav() {
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Nationalregnskabet
        </Link>
        <div className="flex gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
