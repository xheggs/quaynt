'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import type { EChartsOption } from 'echarts';
import type { SeoScoreSnapshot } from '../seo-score.types';

interface ScoreTrendChartProps {
  snapshots: SeoScoreSnapshot[];
  loading?: boolean;
}

export function ScoreTrendChart({ snapshots, loading }: ScoreTrendChartProps) {
  const t = useTranslations('seoScore');

  const option: EChartsOption = useMemo(() => {
    const dates = snapshots.map((s) => s.periodStart);
    const values = snapshots.map((s) => (s.composite === null ? null : s.composite));
    return {
      grid: { left: 40, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, boundaryGap: false },
      yAxis: { type: 'value', min: 0, max: 100 },
      series: [
        {
          name: t('trend.compositeLabel'),
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
        },
      ],
    };
  }, [snapshots, t]);

  const ariaLabel = t('trend.title');
  const dataTable = {
    caption: t('trend.title'),
    headers: ['Date', t('trend.compositeLabel')],
    rows: snapshots.map((s) => [s.periodStart, s.composite === null ? '—' : s.composite]),
  };

  return (
    <EChartsWrapper option={option} ariaLabel={ariaLabel} loading={loading} dataTable={dataTable} />
  );
}
