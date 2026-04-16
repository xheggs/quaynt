import { Skeleton } from '@/components/ui/skeleton';

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-card p-5 ring-1 ring-foreground/10">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card py-4 ring-1 ring-foreground/10">
      <div className="px-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 px-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-7 w-40" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      {/* Section rows */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </div>
  );
}
