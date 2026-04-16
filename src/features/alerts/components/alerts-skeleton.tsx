'use client';

import { TableSkeleton } from '@/components/skeletons';

export function AlertsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b">
        <div className="h-4 w-16 animate-pulse rounded bg-muted mb-2" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted mb-2" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted mb-2" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border border-border">
        <TableSkeleton columns={8} rows={8} />
      </div>
    </div>
  );
}
