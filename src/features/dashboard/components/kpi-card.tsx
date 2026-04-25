'use client';

import { useTranslations } from 'next-intl';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock } from '@/components/ui/stat-block';
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
  /** When true, sparkline draws using `--primary`; otherwise trend color. Defaults false. */
  highlight?: boolean;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  direction,
  sparkline,
  loading,
  className,
  highlight,
}: KpiCardProps) {
  const t = useTranslations('dashboard');

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-full" />
        </div>
      </Card>
    );
  }

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
    <Card className={cn('p-5', className)}>
      <StatBlock
        label={label}
        value={value}
        unit={unit}
        delta={delta}
        direction={direction}
        sparkline={sparkline}
        comparisonLabel={t('kpiCards.vsPrevious')}
        ariaLabel={ariaLabel}
        highlight={highlight}
      />
    </Card>
  );
}
