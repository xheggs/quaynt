'use client';

import { useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

import { EmptyState } from '@/components/empty-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { ErrorState } from '@/components/error-state';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { usePromptSetOptions } from '@/features/dashboard';
import { ExportButton } from '@/components/export-button';

import type { OpportunityViewFilters, OpportunitySortField } from '../opportunity.types';
import { useOpportunityQuery, usePlatformOptions } from '../use-opportunity-query';
import { OpportunityFilterBar } from './opportunity-filters';
import { OpportunitySkeleton } from './opportunity-skeleton';
import { OpportunitySummary } from './opportunity-summary';
import { OpportunityTable } from './opportunity-table';

export function OpportunityView() {
  return (
    <ErrorBoundary>
      <OpportunityContent />
    </ErrorBoundary>
  );
}

const filterParsers = {
  promptSetId: parseAsString,
  brandId: parseAsString,
  platformId: parseAsString,
  type: parseAsString,
  minCompetitors: parseAsInteger,
  from: parseAsString,
  to: parseAsString,
  page: parseAsInteger,
  sort: parseAsString,
  order: parseAsString,
};

function OpportunityContent() {
  const t = useTranslations('opportunities');
  const locale = useLocale();

  const [params, setParams] = useQueryStates(filterParsers, { shallow: false });

  const filters: OpportunityViewFilters = {
    promptSetId: params.promptSetId ?? '',
    brandId: params.brandId ?? '',
    platformId: params.platformId ?? undefined,
    type: (params.type as OpportunityViewFilters['type']) ?? undefined,
    minCompetitorCount: params.minCompetitors ?? undefined,
    from: params.from ?? undefined,
    to: params.to ?? undefined,
  };

  const page = params.page ?? 1;
  const sort = (params.sort as OpportunitySortField) ?? 'score';
  const order = (params.order as 'asc' | 'desc') ?? 'desc';

  const { data, isLoading, isError, error, refetch } = useOpportunityQuery({
    ...filters,
    page,
    limit: 25,
    sort,
    order,
  });

  const { options: promptSetOptions, isLoading: promptSetLoading } = usePromptSetOptions();
  const platformOptions = usePlatformOptions(data);
  const { showSkeleton } = useDelayedLoading(isLoading);

  // Reset page when filters change
  const filterKey = `${filters.promptSetId}|${filters.brandId}|${filters.platformId}|${filters.type}|${filters.minCompetitorCount}|${filters.from}|${filters.to}`;
  useEffect(() => {
    if (page !== 1) {
      setParams({ page: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const handleFiltersChange = (next: OpportunityViewFilters) => {
    setParams({
      promptSetId: next.promptSetId || null,
      brandId: next.brandId || null,
      platformId: next.platformId ?? null,
      type: next.type ?? null,
      minCompetitors: next.minCompetitorCount ?? null,
      from: next.from ?? null,
      to: next.to ?? null,
      page: null, // reset pagination on filter change
      sort: params.sort,
      order: params.order,
    });
  };

  const handleSortChange = (field: OpportunitySortField, dir: 'asc' | 'desc') => {
    setParams({ sort: field, order: dir, page: null });
  };

  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage === 1 ? null : newPage });
  };

  // 1. No prompt sets exist
  if (!filters.promptSetId) {
    if (promptSetOptions.length === 0 && !promptSetLoading) {
      return (
        <EmptyState
          variant="page"
          icon={Lightbulb}
          title={t('empty.noPromptSets')}
          description={t('empty.noPromptSetsDescription')}
          action={{ label: t('empty.noPromptSetsCta'), href: `/${locale}/prompt-sets` }}
        />
      );
    }

    // 2. No market selected
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="type-page">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('header.description')}</p>
        </div>
        <OpportunityFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={[]}
          promptSetLoading={promptSetLoading}
        />
        <EmptyState
          variant="page"
          icon={Lightbulb}
          title={t('empty.noMarket')}
          description={t('empty.noMarketDescription')}
        />
      </div>
    );
  }

  // 3. No brand selected
  if (!filters.brandId) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="type-page">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('header.description')}</p>
        </div>
        <OpportunityFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={[]}
          promptSetLoading={promptSetLoading}
        />
        <EmptyState
          variant="page"
          icon={Lightbulb}
          title={t('empty.noBrand')}
          description={t('empty.noBrandDescription')}
        />
      </div>
    );
  }

  // 4. Loading
  if (showSkeleton) return <OpportunitySkeleton />;

  // 5. Error 403
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

  // 6. Other errors
  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="page" onRetry={refetch} />
      </div>
    );
  }

  // 7. Waiting for data
  if (!data) return null;

  // 8. No data (positive framing)
  if (data.data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="type-page">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('header.description')}</p>
        </div>
        <OpportunityFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          platformOptions={platformOptions}
          promptSetLoading={promptSetLoading}
        />
        <EmptyState
          variant="page"
          icon={Lightbulb}
          title={t('empty.noData')}
          description={t('empty.noDataDescription')}
        />
      </div>
    );
  }

  // 9. Happy path — full view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="type-page">{t('header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('header.description')}</p>
        </div>
        <ExportButton
          exportType="opportunities"
          filters={{
            promptSetId: filters.promptSetId,
            brandId: filters.brandId,
            ...(filters.platformId ? { platformId: filters.platformId } : {}),
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
          }}
          totalCount={data.meta.total}
        />
      </div>

      <OpportunityFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        promptSetOptions={promptSetOptions}
        platformOptions={platformOptions}
        promptSetLoading={promptSetLoading}
      />

      <OpportunitySummary summary={data.summary} />

      <OpportunityTable
        opportunities={data.data}
        sort={sort}
        order={order}
        onSortChange={handleSortChange}
      />

      {data.meta.total > 25 && (
        <DataTablePagination
          page={data.meta.page}
          limit={data.meta.limit}
          total={data.meta.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
