import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
} from "../../../../../components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <Skeleton className="mb-6 h-3 w-72" />
        <Skeleton className="h-10 w-[28rem] max-w-full" />
        <Skeleton className="mt-2 h-4 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {["a", "b"].map((k) => (
            <SkeletonCard key={k} />
          ))}
        </div>
        <div className="mt-10">
          <SkeletonChart height={320} />
        </div>
      </main>
    </div>
  );
}
