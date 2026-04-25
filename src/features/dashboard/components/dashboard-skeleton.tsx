import { AmbientBackdrop } from '@/components/layout/ambient-backdrop';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function HeroSkeleton() {
  return (
    <AmbientBackdrop
      density="band"
      staticOnly
      className="overflow-hidden rounded-md border border-border/60"
    >
      <div className="p-6 md:p-10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="glass-surface mt-6 max-w-2xl rounded-md p-6 md:p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-6 h-px w-12" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
    </AmbientBackdrop>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-8 w-44" />
    </div>
  );
}

function KpiSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md bg-card p-5 ring-1 ring-foreground/10', className)}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-full" />
      </div>
    </div>
  );
}

function SectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md bg-card py-4 ring-1 ring-foreground/10', className)}>
      <div className="flex items-center gap-2 px-5">
        <Skeleton className="h-3 w-6" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-4 space-y-3 px-5 pb-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <HeroSkeleton />
      <FilterBarSkeleton />
      <div className="grid grid-cols-12 gap-4">
        <KpiSkeleton className="col-span-12 md:col-span-6 lg:col-span-4" />
        <KpiSkeleton className="col-span-12 md:col-span-6 lg:col-span-4" />
        <KpiSkeleton className="col-span-12 md:col-span-6 lg:col-span-4" />
        <div className="col-span-12 rounded-md bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <SectionSkeleton className="col-span-12 lg:col-span-6" />
        <SectionSkeleton className="col-span-12 lg:col-span-6" />
        <SectionSkeleton className="col-span-12 lg:col-span-6" />
        <SectionSkeleton className="col-span-12 lg:col-span-6" />
      </div>
    </div>
  );
}
