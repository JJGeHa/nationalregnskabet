import Link from "next/link";

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Sti" className="mb-6 text-[13px] text-[var(--text-muted)]">
      {items.map((crumb, i) => {
        const isLast = i === items.length - 1;
        const separator = i > 0 ? " / " : "";
        if (!crumb.href || isLast) {
          return (
            <span
              key={`${crumb.label}-${i.toString()}`}
              className={isLast ? "text-[var(--foreground)]" : undefined}
            >
              {separator}
              {crumb.label}
            </span>
          );
        }
        return (
          <span key={`${crumb.label}-${i.toString()}`}>
            {separator}
            <Link href={crumb.href} className="hover:text-[var(--foreground)]">
              {crumb.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
