'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import { Skeleton } from '@/components/ui/skeleton';
import type { GscCorrelationTimeSeriesPoint } from '../traffic.api';

interface Props {
  data: GscCorrelationTimeSeriesPoint[] | undefined;
  loading: boolean;
}

export function GscCorrelationChart({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const dates = data.map((p) => p.date);

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category' as const, data: dates, boundaryGap: false },
      yAxis: { type: 'value' as const, name: t('gsc.topQueries.clicks') },
      series: [
        {
          name: t('gsc.chart.aiCited'),
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          data: data.map((p) => p.aiCitedClicks),
        },
        {
          name: t('gsc.chart.allQueries'),
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          data: data.map((p) => p.allClicks),
        },
      ],
    };
  }, [data, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('gsc.chart.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : data && data.length > 0 ? (
          <EChartsWrapper option={option} height={320} ariaLabel={t('gsc.chart.title')} />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">
            {t('gsc.empty.description')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
