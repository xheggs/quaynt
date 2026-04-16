'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

import { EmptyState } from '@/components/empty-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { ErrorState } from '@/components/error-state';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { usePromptSetOptions } from '@/features/dashboard';
import { ExportButton } from '@/components/export-button';

import type { BenchmarkViewFilters } from '../benchmark.types';
import {
  useBenchmarkQuery,
  usePresenceMatrixQuery,
  usePlatformOptions,
} from '../use-benchmark-query';
import { BenchmarkFilterBar } from './benchmark-filters';
import { BenchmarkSkeleton } from './benchmark-skeleton';
import { BenchmarkOverviewTab } from './benchmark-overview-tab';
import { BenchmarkPresenceTab } from './benchmark-presence-tab';

export function BenchmarkView() {
  return (
    <ErrorBoundary>
      <BenchmarkContent />
    </ErrorBoundary>
  );
}

const filterParsers = {
  promptSetId: parseAsString,
  platformId: parseAsString,
  from: parseAsString,
  to: parseAsString,
  comparisonPeriod: parseAsString,
  tab: parseAsString,
  presencePage: parseAsInteger,
};

function BenchmarkContent() {
  const t = useTranslations('benchmarks');
  const locale = useLocale();

  const [params, setParams] = useQueryStates(filterParsers, { shallow: false });

  const filters: BenchmarkViewFilters = {
    promptSetId: params.promptSetId ?? '',
    platformId: params.platformId ?? undefined,
    from: params.from ?? undefined,
    to: params.to ?? undefined,
    comparisonPeriod:
      (params.comparisonPeriod as BenchmarkViewFilters['comparisonPeriod']) ?? undefined,
  };

  const activeTab = params.tab === 'presence' ? 'presence' : 'overview';
  const presencePage = params.presencePage ?? 1;

  const { data, isLoading, isError, error, refetch } = useBenchmarkQuery(filters);
  const { options: promptSetOptions, isLoading: promptSetLoading } = usePromptSetOptions();
  const platformOptions = usePlatformOptions(data);
  const { showSkeleton } = useDelayedLoading(isLoading);

  const presenceFilters = useMemo(
    () => ({
      promptSetId: filters.promptSetId,
      platformId: filters.platformId,
      from: filters.from,
      to: filters.to,
      page: presencePage,
      limit: 25,
    }),
    [filters.promptSetId, filters.platformId, filters.from, filters.to, presencePage]
  );

  const { data: presenceResponse } = usePresenceMatrixQuery({
    ...presenceFilters,
    promptSetId: activeTab === 'presence' ? presenceFilters.promptSetId : '',
  });

  const presenceData = presenceResponse
    ? { rows: presenceResponse.data, total: presenceResponse.meta.total }
    : undefined;

  const brandNames = useMemo(() => data?.brands.map((b) => b.brandName) ?? [], [data]);

  const handleFiltersChange = (next: BenchmarkViewFilters) => {
    setParams({
      promptSetId: next.promptSetId || null,
      platformId: next.platformId ?? null,
      from: next.from ?? null,
      to: next.to ?? null,
      comparisonPeriod: next.comparisonPeriod ?? null,
      tab: params.tab,
      presencePage: null,
    });
  };

  const handleTabChange = (tab: string) => {
    setParams({ ...params, tab: tab === 'overview' ? null : tab, presencePage: null });
  };

  // No market selected
  if (!filters.promptSetId) {
    if (promptSetOptions.length === 0 && !promptSetLoading) {
      return (
        <EmptyState
          variant="page"
          icon={BarChart3}
          title={t('empty.noPromptSets')}
          description={t('empty.noPromptSetsDescription')}
          action={{ label: t('empty.noPromptSetsCta'), href: `/${locale}/prompt-sets` }}
        />
      );
    }
    return (
      <div className="space-y-6">
        <BenchmarkFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={[]}
          promptSetLoading={promptSetLoading}
        />
        <EmptyState
          variant="page"
          icon={BarChart3}
          title={t('empty.noMarket')}
          description={t('empty.noMarketDescription')}
        />
      </div>
    );
  }

  if (showSkeleton) return <BenchmarkSkeleton />;

  // 403 — inaccessible workspace
  if (isError && error && 'status' in error && (error as { status: number }).status === 403) {
    return (
      <div className="py-12">
        <ErrorState
          variant="page"
          title={t('error.noAccess')}
          description={t('error.noAccessDescription')}
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="page" onRetry={refetch} />
      </div>
    );
  }

  if (!data) return null;

  // Empty data
  if (data.brands.length === 0) {
    return (
      <div className="space-y-6">
        <BenchmarkFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={platformOptions}
          promptSetLoading={promptSetLoading}
        />
        <EmptyState
          variant="page"
          icon={BarChart3}
          title={t('empty.noData')}
          description={t('empty.noDataDescription')}
        />
      </div>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-2">
        <BenchmarkFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={platformOptions}
          promptSetLoading={promptSetLoading}
        />
        <div className="flex items-center justify-between">
          <p className="type-caption text-muted-foreground">
            {data.meta.lastUpdatedAt &&
              t('dataAsOf', { date: dateFormatter.format(new Date(data.meta.lastUpdatedAt)) })}
            {data.meta.lastUpdatedAt && ' \u00b7 '}
            {t('totalBrands', { count: data.meta.totalBrands })}
            {' \u00b7 '}
            {t('totalPrompts', { count: data.meta.totalPrompts })}
          </p>
          <ExportButton
            exportType="recommendation-share"
            filters={{
              promptSetId: filters.promptSetId,
              ...(filters.platformId ? { platformId: filters.platformId } : {}),
              ...(filters.from ? { from: filters.from } : {}),
              ...(filters.to ? { to: filters.to } : {}),
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleTabChange('overview')}
        >
          {t('tabs.overview')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'presence'}
          className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            activeTab === 'presence'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleTabChange('presence')}
        >
          {t('tabs.presence')}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <BenchmarkOverviewTab data={data} />
      ) : (
        <BenchmarkPresenceTab
          presenceData={presenceData}
          brandNames={brandNames}
          page={presencePage}
          onPageChange={(page) => setParams({ ...params, presencePage: page })}
        />
      )}
    </div>
  );
}
