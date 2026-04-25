'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import type { DashboardMover } from '../dashboard.types';

interface MoversSectionProps {
  movers: DashboardMover[] | null;
  className?: string;
}

const directionIcon = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const;

const directionColor = {
  up: 'text-success',
  down: 'text-destructive',
  stable: 'text-muted-foreground',
} as const;

export function MoversSection({ movers, className }: MoversSectionProps) {
  const t = useTranslations('dashboard');

  return (
    <SectionCard
      index="01"
      title={t('sections.movers')}
      indexLabel={t('sections.indexLabel', { index: '01' })}
      className={className}
    >
      {movers === null ? (
        <ErrorState
          variant="inline"
          description={t('warnings.sectionFailed', { section: t('sections.movers') })}
        />
      ) : movers.length === 0 ? (
        <EmptyState variant="inline" icon={TrendingUp} title={t('movers.empty')} />
      ) : (
        <ul className="divide-y divide-border" data-testid="movers-list">
          {movers.map((mover) => {
            const Icon = mover.direction ? directionIcon[mover.direction] : Minus;
            const color = mover.direction
              ? directionColor[mover.direction]
              : 'text-muted-foreground';

            return (
              <li
                key={mover.brandId}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="truncate text-sm text-foreground">{mover.brandName}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {mover.current}
                  </span>
                  <span className={cn('inline-flex items-center gap-1', color)}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    <span className="font-mono text-sm tabular-nums">{mover.delta}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
