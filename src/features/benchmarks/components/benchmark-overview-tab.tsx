'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BenchmarkResult } from '../benchmark.types';
import { ShareBarChart } from './share-bar-chart';
import { PeriodComparisonChart } from './period-comparison-chart';
import { BenchmarkTable } from './benchmark-table';
import { PlatformBreakdown } from './platform-breakdown';

interface BenchmarkOverviewTabProps {
  data: BenchmarkResult;
  loading?: boolean;
}

export function BenchmarkOverviewTab({ data, loading }: BenchmarkOverviewTabProps) {
  const t = useTranslations('benchmarks');

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('charts.shareByBrand')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareBarChart brands={data.brands} marketName={data.market.name} loading={loading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('charts.periodComparison')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodComparisonChart
              brands={data.brands}
              period={data.period}
              marketName={data.market.name}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Comparison table */}
      <BenchmarkTable brands={data.brands} />

      {/* Platform breakdown */}
      <PlatformBreakdown brands={data.brands} />
    </div>
  );
}
