'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

import { ErrorBoundary } from '@/components/error-boundary';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import {
  useSummaryQuery,
  useTimeSeriesQuery,
  usePlatformsQuery,
  useTopPagesQuery,
  useRecentVisitsQuery,
} from '../use-traffic-queries';
import type { AnalyticsFilters, VisitSource } from '../traffic.types';
import { TrafficKpiCards } from './traffic-kpi-cards';
import { TrafficFilters } from './traffic-filters';
import { TrafficTimeSeriesChart } from './traffic-timeseries-chart';
import { TrafficPlatformTable } from './traffic-platform-table';
import { TrafficTopPagesTable } from './traffic-top-pages-table';
import { TrafficRecentFeed } from './traffic-recent-feed';
import { TrafficEmptyState } from './traffic-empty-state';
import { TrafficSkeleton } from './traffic-skeleton';
import { GscCorrelationSection } from './gsc-correlation-section';

export function TrafficView() {
  return (
    <ErrorBoundary>
      <TrafficContent />
    </ErrorBoundary>
  );
}

const filterParsers = {
  from: parseAsString,
  to: parseAsString,
  platform: parseAsString,
  source: parseAsString,
};

function TrafficContent() {
  const t = useTranslations('aiTraffic');

  const [params, setParams] = useQueryStates(filterParsers, { shallow: false });

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filters: AnalyticsFilters = {
    from: params.from ?? thirtyDaysAgo.toISOString().slice(0, 10),
    to: params.to ?? now.toISOString().slice(0, 10),
    platform: params.platform ?? undefined,
    source: (params.source as VisitSource | undefined) ?? undefined,
  };

  const summary = useSummaryQuery(filters);
  const timeSeries = useTimeSeriesQuery(filters);
  const platforms = usePlatformsQuery(filters);
  const topPages = useTopPagesQuery(filters);
  const recent = useRecentVisitsQuery(filters, 1, 25);

  const { showSkeleton } = useDelayedLoading(summary.isLoading);

  if (showSkeleton) return <TrafficSkeleton />;

  const totalVisits = summary.data?.totalVisits ?? 0;
  if (totalVisits === 0 && !summary.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <TrafficEmptyState />
      </div>
    );
  }

  const availablePlatforms = platforms.data?.map((p) => p.platform) ?? [];
  const recentItems = recent.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
      </div>

      <TrafficFilters
        filters={filters}
        onFiltersChange={(changes) => setParams(changes as Record<string, string | null>)}
        availablePlatforms={availablePlatforms}
      />

      <TrafficKpiCards data={summary.data} loading={summary.isLoading} />

      <TrafficTimeSeriesChart data={timeSeries.data} loading={timeSeries.isLoading} />

      <TrafficPlatformTable data={platforms.data} loading={platforms.isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TrafficTopPagesTable data={topPages.data} loading={topPages.isLoading} />
        <TrafficRecentFeed data={recentItems} loading={recent.isLoading} />
      </div>

      <GscCorrelationSection filters={{ from: filters.from, to: filters.to }} />
    </div>
  );
}
