import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function NoEngineNotice({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

export function PartialErrorNotice({
  href,
  message,
  cta,
}: {
  href: string;
  message: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4">
      <p className="text-xs">{message}</p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={href}>{cta}</Link>
      </Button>
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
