'use client';

import { MousePointerClick, Eye, Compass, CheckCheck, CircleDashed } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GscCorrelationSummary } from '../traffic.api';

interface Props {
  data: GscCorrelationSummary | undefined;
  loading: boolean;
}

export function GscKpiCards({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);
  const positionFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const cards = [
    {
      key: 'aiCitedClicks',
      icon: MousePointerClick,
      value: numberFormat.format(data?.aiCitedClicks ?? 0),
    },
    {
      key: 'aiCitedImpressions',
      icon: Eye,
      value: numberFormat.format(data?.aiCitedImpressions ?? 0),
    },
    {
      key: 'avgPosition',
      icon: Compass,
      value: data?.avgPosition != null ? positionFormat.format(data.avgPosition) : '—',
    },
    {
      key: 'distinctQueries',
      icon: CheckCheck,
      value: numberFormat.format(data?.distinctQueries ?? 0),
    },
    {
      key: 'gapQueries',
      icon: CircleDashed,
      value: numberFormat.format(data?.gapQueries ?? 0),
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, icon: Icon, value }) => (
        <Card key={key} className="border-l-2 border-l-primary p-5">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
              <span>{t(`gsc.kpi.${key}` as never)}</span>
            </div>
            <div className="mt-2">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
