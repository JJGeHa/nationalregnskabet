export function ErrorBanner({
  title = "Noget gik galt",
  message,
  hint,
}: {
  title?: string;
  message: string;
  hint?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50/70 px-5 py-4 text-[13px] text-red-800 shadow-sm"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-red-700">{message}</div>
      {hint && <div className="mt-1 text-[12px] text-red-600/80">{hint}</div>}
    </div>
  );
}
