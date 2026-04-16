'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { EChartsWrapper, type ChartDataTable } from '@/components/charts';
import type { BrandBenchmark } from '../benchmark.types';
import type { EChartsOption } from 'echarts';

const MAX_BRANDS = 15;

interface ShareBarChartProps {
  brands: BrandBenchmark[];
  marketName: string;
  loading?: boolean;
}

export function ShareBarChart({ brands, marketName, loading }: ShareBarChartProps) {
  const t = useTranslations('benchmarks');

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
    // Reverse for horizontal bar (bottom-to-top = highest share at top)
    const sorted = [...displayBrands].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number; dataIndex: number }>)[0];
          const brand = sorted[p.dataIndex];
          const delta = brand?.recommendationShare.delta;
          const deltaStr = delta ? ` (${parseFloat(delta) > 0 ? '+' : ''}${delta}%)` : '';
          return `${p.name}: ${p.value}%${deltaStr}`;
        },
      },
      grid: { left: '3%', right: '6%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: { type: 'value', max: 100, name: t('charts.sharePercent') },
      yAxis: { type: 'category', data: sorted.map((b) => b.brandName) },
      series: [
        {
          type: 'bar',
          data: sorted.map((b) => parseFloat(b.recommendationShare.current)),
        },
      ],
    };
  }, [displayBrands, t]);

  const dataTable = useMemo<ChartDataTable>(
    () => ({
      caption: t('charts.ariaShareBar', { market: marketName }),
      headers: [t('charts.brandHeader'), t('charts.sharePercent')],
      rows: displayBrands.map((b) => [b.brandName, `${b.recommendationShare.current}%`]),
    }),
    [displayBrands, marketName, t]
  );

  if (brands.length === 0) return null;

  return (
    <div>
      <EChartsWrapper
        option={option}
        height={Math.max(200, displayBrands.length * 32 + 40)}
        ariaLabel={t('charts.ariaShareBar', { market: marketName })}
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
