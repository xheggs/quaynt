import { Skeleton } from '@/components/ui/skeleton';

export function DetailSkeleton() {
  return (
    <div data-slot="detail-skeleton" className="space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-3 w-48 rounded" />
      {/* Heading */}
      <Skeleton className="h-6 w-64 rounded" />
      {/* Two-column content */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/6 rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-24 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
