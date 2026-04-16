'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { EChartsWrapper, type ChartDataTable } from '@/components/charts';
import type { BrandBenchmark } from '../benchmark.types';
import type { EChartsOption } from 'echarts';

const MAX_BRANDS = 15;

interface PeriodComparisonChartProps {
  brands: BrandBenchmark[];
  period: {
    from: string;
    to: string;
    comparisonFrom: string | null;
    comparisonTo: string | null;
  };
  marketName: string;
  loading?: boolean;
}

export function PeriodComparisonChart({ brands, marketName, loading }: PeriodComparisonChartProps) {
  const t = useTranslations('benchmarks');

  const hasComparison = brands.some((b) => b.recommendationShare.previous !== null);

  const displayBrands = useMemo(
    () =>
      [...brands]
        .sort(
          (a, b) =>
            parseFloat(b.recommendationShare.current) - parseFloat(a.recommendationShare.current)
        )
        .slice(0, MAX_BRANDS),
    [brands]
  );

  const option = useMemo<EChartsOption>(() => {
    const names = displayBrands.map((b) => b.brandName);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{
            name: string;
            seriesName: string;
            value: number;
            dataIndex: number;
          }>;
          const brand = displayBrands[items[0].dataIndex];
          const delta = brand?.recommendationShare.delta;
          const deltaStr = delta ? ` (${parseFloat(delta) > 0 ? '+' : ''}${delta}%)` : '';
          return items
            .map((i) => `${i.seriesName}: ${i.value}%`)
            .join('<br/>')
            .concat(deltaStr ? `<br/>${deltaStr}` : '');
        },
      },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '3%', containLabel: true },
      xAxis: { type: 'category', data: names },
      yAxis: { type: 'value', name: t('charts.sharePercent') },
      series: [
        {
          name: t('charts.previousPeriod'),
          type: 'bar',
          data: displayBrands.map((b) =>
            b.recommendationShare.previous ? parseFloat(b.recommendationShare.previous) : 0
          ),
          itemStyle: { opacity: 0.4 },
        },
        {
          name: t('charts.currentPeriod'),
          type: 'bar',
          data: displayBrands.map((b) => parseFloat(b.recommendationShare.current)),
        },
      ],
    };
  }, [displayBrands, t]);

  const dataTable = useMemo<ChartDataTable>(
    () => ({
      caption: t('charts.ariaPeriodComparison', { market: marketName }),
      headers: [t('charts.brandHeader'), t('charts.previousPeriod'), t('charts.currentPeriod')],
      rows: displayBrands.map((b) => [
        b.brandName,
        b.recommendationShare.previous ? `${b.recommendationShare.previous}%` : '-',
        `${b.recommendationShare.current}%`,
      ]),
    }),
    [displayBrands, marketName, t]
  );

  if (brands.length === 0) return null;

  if (!hasComparison) {
    return (
      <p className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        {t('charts.noDataForChart')}
      </p>
    );
  }

  return (
    <div>
      <EChartsWrapper
        option={option}
        height={320}
        ariaLabel={t('charts.ariaPeriodComparison', { market: marketName })}
        loading={loading}
        dataTable={dataTable}
      />
      {brands.length > MAX_BRANDS && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('charts.showingTopBrands', { count: MAX_BRANDS, total: brands.length })}
        </p>
      )}
    </div>
  );
}
