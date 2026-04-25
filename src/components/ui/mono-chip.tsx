import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Small mono uppercase chip used for inline status labels such as
 * `NOW TRACKING · CLAUDE`, `LIVE`, `UPDATED Apr 25 · 12:36`.
 *
 * These are intentionally not pill-shaped — they render as inline text
 * with optional pulsing dot, matching the typographic rhythm of
 * the broader design system.
 */
export type MonoChipTone = 'default' | 'live' | 'muted' | 'success' | 'warning' | 'destructive';

export type MonoChipProps = {
  children: ReactNode;
  className?: string;
  tone?: MonoChipTone;
  /** When true and `tone === 'live'`, show a leading pulsing dot. */
  pulse?: boolean;
  as?: 'span' | 'div';
};

const toneClass: Record<MonoChipTone, string> = {
  default: 'text-muted-foreground',
  live: 'text-foreground',
  muted: 'text-muted-foreground/80',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export function MonoChip({
  children,
  className,
  tone = 'default',
  pulse = false,
  as: Component = 'span',
}: MonoChipProps) {
  const showPulse = pulse && tone === 'live';

  return (
    <Component
      className={cn(
        'inline-flex items-center gap-1.5 font-mono type-overline',
        toneClass[tone],
        className
      )}
    >
      {showPulse && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current animate-[live-pulse_1.2s_ease-in-out_infinite]"
        />
      )}
      {children}
    </Component>
  );
}
