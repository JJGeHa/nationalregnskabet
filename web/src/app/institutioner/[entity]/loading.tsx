import { Skeleton } from "../../../components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        <Skeleton className="mb-6 h-3 w-56" />
        <Skeleton className="h-10 w-[28rem] max-w-full" />
        <Skeleton className="mt-2 h-4 w-52" />
        <div className="mt-6 flex flex-wrap gap-3">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-14 w-40" />
          ))}
        </div>
        <section className="mt-10">
          <Skeleton className="h-7 w-48" />
          <div className="mt-5 space-y-2">
            {["a", "b", "c", "d", "e"].map((k) => (
              <Skeleton key={k} className="h-14 w-full" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
