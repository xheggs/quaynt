import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ErrorChipProps = {
  message: string;
  className?: string;
};

export function ErrorChip({ message, className }: ErrorChipProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex animate-in items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive fade-in slide-in-from-bottom-1 duration-300',
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
