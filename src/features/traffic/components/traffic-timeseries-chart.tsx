'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import { Skeleton } from '@/components/ui/skeleton';
import type { TimeSeriesPoint } from '../traffic.types';
import { PLATFORM_DISPLAY_NAMES } from './platform-display';

interface Props {
  data: TimeSeriesPoint[] | undefined;
  loading: boolean;
}

export function TrafficTimeSeriesChart({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const byPlatform = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();
    for (const point of data) {
      allDates.add(point.date);
      if (!byPlatform.has(point.platform)) byPlatform.set(point.platform, new Map());
      byPlatform.get(point.platform)!.set(point.date, point.visits);
    }

    const sortedDates = [...allDates].sort();
    const series = [...byPlatform.entries()].map(([platform, dateMap]) => ({
      name: PLATFORM_DISPLAY_NAMES[platform] ?? platform,
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      data: sortedDates.map((date) => dateMap.get(date) ?? 0),
    }));

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { type: 'scroll' as const, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category' as const, data: sortedDates, boundaryGap: false },
      yAxis: { type: 'value' as const, name: t('chart.visits') },
      series,
    };
  }, [data, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('chart.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : data && data.length > 0 ? (
          <EChartsWrapper option={option} height={320} ariaLabel={t('chart.title')} />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">
            {t('empty.description')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
