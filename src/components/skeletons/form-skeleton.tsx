import { Skeleton } from '@/components/ui/skeleton';

interface FormSkeletonProps {
  fields?: number;
}

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div data-slot="form-skeleton" className="space-y-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          {/* Label */}
          <Skeleton className="h-3 w-24 rounded" />
          {/* Input */}
          <Skeleton className="h-9 w-full rounded" />
        </div>
      ))}
      {/* Submit button */}
      <Skeleton className="h-7 w-20 rounded" />
    </div>
  );
}
