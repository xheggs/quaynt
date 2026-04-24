'use client';

import { cn } from '@/lib/utils';

export interface ScoreRingProps {
  value: number | null;
  delta?: number | null;
  capped?: boolean;
  outOfLabel: string;
  ariaLabel: string;
  capLabel?: string;
  capTooltip?: string;
  size?: number;
  className?: string;
}

const DEFAULT_SIZE = 180;
const STROKE = 12;

function colorClass(value: number): string {
  if (value < 40) return 'text-destructive';
  if (value < 70) return 'text-amber-500';
  return 'text-emerald-500';
}

export function ScoreRing({
  value,
  delta,
  capped,
  outOfLabel,
  ariaLabel,
  capLabel,
  capTooltip,
  size = DEFAULT_SIZE,
  className,
}: ScoreRingProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasValue = value !== null && !Number.isNaN(value);
  const displayValue = hasValue ? Math.round(value!) : null;
  const progress = hasValue ? Math.max(0, Math.min(100, value!)) : 0;
  const dashOffset = circumference - (circumference * progress) / 100;
  const arcColor = hasValue ? colorClass(value!) : 'text-muted-foreground';

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={STROKE}
            fill="none"
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={hasValue ? dashOffset : circumference}
            className={cn(
              arcColor,
              !hasValue && 'opacity-50',
              'transition-[stroke-dashoffset] duration-500'
            )}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={!hasValue ? { strokeDasharray: '6 6' } : undefined}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="type-kpi text-foreground text-4xl font-semibold tabular-nums">
            {hasValue ? displayValue : '—'}
          </span>
          <span className="type-overline text-muted-foreground text-xs">{outOfLabel}</span>
        </div>
      </div>
      {capped && capLabel && (
        <span
          className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
          title={capTooltip}
        >
          {capLabel}
        </span>
      )}
      {delta !== undefined && delta !== null && (
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            delta > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : delta < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
          )}
        >
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
    </div>
  );
}
