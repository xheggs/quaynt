'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/skeletons';

function SkeletonHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

export function AdaptersSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-4 w-72" />
      <div className="rounded-md border border-border">
        <TableSkeleton columns={5} rows={4} />
      </div>
    </div>
  );
}

export function ApiKeysSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-4 w-72" />
      <div className="rounded-md border border-border">
        <TableSkeleton columns={5} rows={3} />
      </div>
    </div>
  );
}

export function WebhooksSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-4 w-72" />
      <div className="rounded-md border border-border">
        <TableSkeleton columns={4} rows={3} />
      </div>
    </div>
  );
}
