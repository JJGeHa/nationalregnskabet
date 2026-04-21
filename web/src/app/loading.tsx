import { Skeleton, SkeletonChart } from "../components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <main className="w-full max-w-6xl">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-12 w-[32rem] max-w-full" />
        <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {["a", "b", "c", "d", "e"].map((k) => (
            <Skeleton key={k} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="mt-10">
          <SkeletonChart height={480} />
        </div>
      </main>
    </div>
  );
}
