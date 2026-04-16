'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';
import type { SparklinePoint } from '../dashboard.types';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: string | null;
  direction?: 'up' | 'down' | 'stable' | null;
  sparkline?: SparklinePoint[];
  loading?: boolean;
  className?: string;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    sparkline: 'var(--color-emerald-500)',
  },
  down: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    sparkline: 'var(--color-red-500)',
  },
  stable: {
    icon: Minus,
    color: 'text-muted-foreground',
    sparkline: 'var(--color-muted-foreground)',
  },
} as const;

export function KpiCard({
  label,
  value,
  unit,
  delta,
  direction,
  sparkline,
  loading,
  className,
}: KpiCardProps) {
  const t = useTranslations('dashboard');

  if (loading) {
    return (
      <Card className={cn('bg-gradient-to-t from-primary/5 to-card p-5', className)}>
        <CardContent className="space-y-3 p-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  const trend = direction && direction in trendConfig ? trendConfig[direction] : null;
  const TrendIcon = trend?.icon;

  const ariaLabel =
    direction && delta
      ? t('kpiCards.ariaLabel', {
          label,
          value,
          direction: t(
            `kpiCards.trend${direction.charAt(0).toUpperCase()}${direction.slice(1)}` as 'kpiCards.trendUp'
          ),
          delta,
        })
      : t('kpiCards.ariaLabelNoTrend', { label, value });

  return (
    <Card
      className={cn('bg-gradient-to-t from-primary/5 to-card p-5', className)}
      aria-label={ariaLabel}
    >
      <CardContent className="space-y-3 p-0">
        <p className="type-overline text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="type-kpi text-foreground">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {trend && (
          <div className="flex items-center gap-1.5">
            {TrendIcon && <TrendIcon className={cn('size-3.5', trend.color)} aria-hidden="true" />}
            {delta && (
              <span className={cn('text-sm font-medium tabular-nums', trend.color)}>{delta}</span>
            )}
            <span className="text-xs text-muted-foreground">{t('kpiCards.vsPrevious')}</span>
          </div>
        )}
        {sparkline && sparkline.length > 0 && (
          <Sparkline
            data={sparkline}
            width={200}
            height={28}
            color={trend?.sparkline ?? 'var(--primary)'}
            className="w-full"
          />
        )}
      </CardContent>
    </Card>
  );
}
