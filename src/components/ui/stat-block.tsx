import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Sparkline } from '@/components/ui/sparkline';
import type { SparklinePoint } from '@/features/dashboard/dashboard.types';
import { cn } from '@/lib/utils';

/**
 * Pulled-out big-number block for KPIs. Reuses `Sparkline`.
 *
 * Note: `StatBlock` deliberately does NOT render an outer `Card` — it is
 * intended to be composed inside a card or section by the consumer.
 */
export type StatBlockDirection = 'up' | 'down' | 'stable';

export type StatBlockProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: string | null;
  direction?: StatBlockDirection | null;
  sparkline?: SparklinePoint[];
  /** "vs previous period" caption. */
  comparisonLabel?: string;
  /** Pre-assembled aria-label (e.g. "Total citations 1,204, up 12% vs previous period"). */
  ariaLabel?: string;
  className?: string;
  /** When true, sparkline draws using `--primary`; otherwise it uses the trend color. */
  highlight?: boolean;
};

const directionIcon: Record<StatBlockDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const directionTextClass: Record<StatBlockDirection, string> = {
  up: 'text-success',
  down: 'text-destructive',
  stable: 'text-muted-foreground',
};

const directionStrokeVar: Record<StatBlockDirection, string> = {
  up: 'var(--success)',
  down: 'var(--destructive)',
  stable: 'var(--muted-foreground)',
};

export function StatBlock({
  label,
  value,
  unit,
  delta,
  direction,
  sparkline,
  comparisonLabel,
  ariaLabel,
  className,
  highlight = false,
}: StatBlockProps) {
  const Icon = direction ? directionIcon[direction] : null;
  const trendColor = direction ? directionTextClass[direction] : 'text-muted-foreground';
  const sparklineColor = highlight
    ? 'var(--primary)'
    : direction
      ? directionStrokeVar[direction]
      : 'var(--muted-foreground)';

  const showTrend = Boolean(Icon || delta || comparisonLabel);
  const hasSparkline = Boolean(sparkline && sparkline.length > 0);

  return (
    <div aria-label={ariaLabel} className={cn('flex flex-col gap-3', className)}>
      <p className="type-overline text-muted-foreground">{label}</p>

      <div className="flex items-baseline gap-2">
        <span className="type-kpi text-foreground tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      {showTrend && (
        <div className={cn('flex items-center gap-2', trendColor)}>
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
          {delta && <span className="font-mono text-sm tabular-nums">{delta}</span>}
          {comparisonLabel && (
            <span className="type-caption text-muted-foreground">{comparisonLabel}</span>
          )}
        </div>
      )}

      {hasSparkline && (
        <Sparkline
          data={sparkline as SparklinePoint[]}
          width={160}
          height={28}
          color={sparklineColor}
          className="w-full h-[28px]"
        />
      )}
    </div>
  );
}
