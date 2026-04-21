import { Skeleton, SkeletonCard } from "../../../components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-5xl">
        <Skeleton className="mb-6 h-3 w-48" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-40" />
        <section className="mt-10">
          <Skeleton className="h-7 w-48" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {["a", "b", "c"].map((k) => (
              <SkeletonCard key={k} />
            ))}
          </div>
        </section>
        <section className="mt-10">
          <Skeleton className="h-7 w-56" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {["a", "b", "c", "d"].map((k) => (
              <SkeletonCard key={k} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
