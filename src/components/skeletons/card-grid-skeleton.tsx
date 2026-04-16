import { CardSkeleton } from './card-skeleton';

interface CardGridSkeletonProps {
  count?: number;
  columns?: number;
}

export function CardGridSkeleton({ count = 4, columns = 2 }: CardGridSkeletonProps) {
  return (
    <div
      data-slot="card-grid-skeleton"
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
