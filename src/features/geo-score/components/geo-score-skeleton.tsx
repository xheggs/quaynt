'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function GeoScoreSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <Skeleton className="size-[180px] rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
