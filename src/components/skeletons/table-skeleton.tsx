import { Skeleton } from '@/components/ui/skeleton';

const COLUMN_WIDTHS = ['60%', '40%', '75%', '50%', '65%'];

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 10 }: TableSkeletonProps) {
  return (
    <div data-slot="table-skeleton" className="w-full">
      {/* Header */}
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-3 rounded"
            style={{ width: COLUMN_WIDTHS[i % COLUMN_WIDTHS.length] }}
          />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-4 rounded"
              style={{ width: COLUMN_WIDTHS[colIndex % COLUMN_WIDTHS.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
