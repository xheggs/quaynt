import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div data-slot="card-skeleton" className="rounded-lg border border-border bg-card p-6">
      <Skeleton className="mb-2 h-4 w-1/3 rounded" />
      <Skeleton className="mb-4 h-3 w-2/3 rounded" />
      <Skeleton className="h-20 w-full rounded" />
    </div>
  );
}
