'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/error-state';
import { cn } from '@/lib/utils';
import type { DashboardMover } from '../dashboard.types';

interface MoversSectionProps {
  movers: DashboardMover[] | null;
}

const directionIcon = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const;

const directionColor = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  stable: 'text-muted-foreground',
} as const;

export function MoversSection({ movers }: MoversSectionProps) {
  const t = useTranslations('dashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-section">{t('sections.movers')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 px-4 pb-4">
        {movers === null ? (
          <ErrorState
            variant="inline"
            description={t('warnings.sectionFailed', { section: t('sections.movers') })}
          />
        ) : movers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('movers.empty')}</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="movers-list">
            {movers.map((mover) => {
              const Icon = mover.direction ? directionIcon[mover.direction] : null;
              const color = mover.direction
                ? directionColor[mover.direction]
                : 'text-muted-foreground';

              return (
                <li
                  key={mover.brandId}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-sm text-foreground">{mover.brandName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-foreground">{mover.current}</span>
                    <div className="flex items-center gap-1">
                      {Icon && <Icon className={cn('size-3.5', color)} aria-hidden="true" />}
                      <span className={cn('text-xs tabular-nums', color)}>{mover.delta}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
