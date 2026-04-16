import { Skeleton } from '@/components/ui/skeleton';

function FilterBarSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-7 w-40" />
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg bg-card p-5 ring-1 ring-foreground/10">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg bg-card ring-1 ring-foreground/10">
      <div className="flex gap-8 border-b px-4 py-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

export function OpportunitySkeleton() {
  return (
    <div className="space-y-6">
      <FilterBarSkeleton />
      <SummaryCardsSkeleton />
      <TableSkeleton />
      <PaginationSkeleton />
    </div>
  );
}
