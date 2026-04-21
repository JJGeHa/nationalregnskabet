import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
} from "../../components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-6xl">
        <Skeleton className="mb-6 h-3 w-48" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((k) => (
            <SkeletonCard key={k} />
          ))}
        </div>
        <div className="mt-10">
          <SkeletonChart height={400} />
        </div>
      </main>
    </div>
  );
}
