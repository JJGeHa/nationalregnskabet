export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={`line-${i.toString()}`}
          className="h-3"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function SkeletonChart({ height = 360 }: { height?: number }) {
  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      style={{ height }}
    >
      <Skeleton className="h-full w-full" />
    </div>
  );
}
