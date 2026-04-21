export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="text-[15px] font-medium text-[var(--foreground)]">
        {title}
      </div>
      {description && (
        <div className="mt-2 text-[13px] text-[var(--text-muted)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
