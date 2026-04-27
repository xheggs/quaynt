export function PartialErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4">
      <p className="text-xs">{message}</p>
    </div>
  );
}

export function Skeleton({ lines, testId }: { lines: number; testId?: string }) {
  return (
    <div
      data-testid={testId ?? 'review-skeleton'}
      className="flex flex-col gap-2 motion-safe:animate-pulse"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-muted" />
      ))}
    </div>
  );
}
