import { Skeleton } from '@/components/ui/skeleton';

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card p-5 ring-1 ring-foreground/10">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-[280px] w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg bg-card ring-1 ring-foreground/10">
      <div className="flex gap-8 border-b px-4 py-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card p-5 ring-1 ring-foreground/10">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-56" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function BenchmarkSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-40" />
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton />
      {/* Platform breakdown */}
      <PlatformSkeleton />
    </div>
  );
}
