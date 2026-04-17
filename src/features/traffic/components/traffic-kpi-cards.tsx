'use client';

import { BarChart3, Globe, Layers, TrendingUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyticsSummary } from '../traffic.types';
import { PLATFORM_DISPLAY_NAMES } from './platform-display';

interface Props {
  data: AnalyticsSummary | undefined;
  loading: boolean;
}

export function TrafficKpiCards({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);

  const topPlatformLabel = data?.topPlatform
    ? (PLATFORM_DISPLAY_NAMES[data.topPlatform] ?? data.topPlatform)
    : '—';

  const cards = [
    { key: 'totalVisits', icon: BarChart3, value: numberFormat.format(data?.totalVisits ?? 0) },
    { key: 'topPlatform', icon: TrendingUp, value: topPlatformLabel },
    { key: 'topLandingPage', icon: Globe, value: data?.topLandingPage ?? '—' },
    {
      key: 'distinctPlatforms',
      icon: Layers,
      value: numberFormat.format(data?.distinctPlatforms ?? 0),
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, icon: Icon, value }) => (
        <Card key={key} className="border-l-2 border-l-primary p-5">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" />
              <span>{t(`kpi.${key}` as never)}</span>
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
