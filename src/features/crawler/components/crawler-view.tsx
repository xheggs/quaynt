'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

import { ErrorBoundary } from '@/components/error-boundary';
import { EmptyState } from '@/components/empty-state';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import {
  useSummaryQuery,
  useTimeSeriesQuery,
  useBotBreakdownQuery,
  useTopPagesQuery,
  useCoverageGapsQuery,
  useUploadsQuery,
} from '../use-crawler-queries';
import type { AnalyticsFilters } from '../crawler.types';
import { CrawlerKpiCards } from './crawler-kpi-cards';
import { CrawlerFilters } from './crawler-filters';
import { BotActivityChart } from './bot-activity-chart';
import { BotBreakdownTable } from './bot-breakdown-table';
import { TopPagesTable } from './top-pages-table';
import { CoverageGapsTable } from './coverage-gaps-table';
import { CrawlerUploadDialog } from './crawler-upload-dialog';
import { CrawlerSkeleton } from './crawler-skeleton';

export function CrawlerView() {
  return (
    <ErrorBoundary>
      <CrawlerContent />
    </ErrorBoundary>
  );
}

const filterParsers = {
  from: parseAsString,
  to: parseAsString,
  botName: parseAsString,
  botCategory: parseAsString,
};

function CrawlerContent() {
  const t = useTranslations('crawlerAnalytics');

  const [params, setParams] = useQueryStates(filterParsers, { shallow: false });

  // Default date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filters: AnalyticsFilters = {
    from: params.from ?? thirtyDaysAgo.toISOString().slice(0, 10),
    to: params.to ?? now.toISOString().slice(0, 10),
    botName: params.botName ?? undefined,
    botCategory: params.botCategory as AnalyticsFilters['botCategory'],
  };

  // Fetch all analytics in parallel
  const summary = useSummaryQuery(filters);
  const timeSeries = useTimeSeriesQuery(filters);
  const botBreakdown = useBotBreakdownQuery(filters);
  const topPages = useTopPagesQuery(filters);
  const coverageGaps = useCoverageGapsQuery(filters);
  const uploads = useUploadsQuery({ page: 1, limit: 1 });

  const isLoading = summary.isLoading;
  const { showSkeleton } = useDelayedLoading(isLoading);

  // Get bot names for filter dropdown
  const botNames = botBreakdown.data?.data?.map((b) => b.botName) ?? [];

  // Empty state: no uploads at all
  const hasNoData = !uploads.isLoading && (uploads.data?.data?.length ?? 0) === 0;

  if (showSkeleton) return <CrawlerSkeleton />;

  if (hasNoData && !summary.data?.data?.totalVisits) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('page.title')}</h1>
            <p className="text-muted-foreground">{t('page.description')}</p>
          </div>
          <CrawlerUploadDialog />
        </div>
        <EmptyState icon={Bot} title={t('empty.title')} description={t('empty.description')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <CrawlerUploadDialog />
      </div>

      {/* Filters */}
      <CrawlerFilters
        filters={filters}
        onFiltersChange={(changes) => setParams(changes as Record<string, string | null>)}
        botNames={botNames}
      />

      {/* KPI Cards */}
      <CrawlerKpiCards data={summary.data?.data} loading={summary.isLoading} />

      {/* Bot Activity Chart */}
      <BotActivityChart data={timeSeries.data?.data} loading={timeSeries.isLoading} />

      {/* Bot Breakdown */}
      <BotBreakdownTable data={botBreakdown.data?.data} loading={botBreakdown.isLoading} />

      {/* Two-column layout for Pages and Gaps */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopPagesTable data={topPages.data?.data} loading={topPages.isLoading} />
        <CoverageGapsTable data={coverageGaps.data?.data} loading={coverageGaps.isLoading} />
      </div>
    </div>
  );
}
