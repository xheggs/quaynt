'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { FileSearch } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { CitationRecord, CitationListFilters } from '../citation.types';
import { fetchCitations } from '../citation.api';
import { useCitationColumns } from './citation-columns';
import { CitationFilters } from './citation-filters';
import { ExportCitationsButton } from './export-citations-button';

const citationFilterParsers = {
  brandId: parseAsString,
  platformId: parseAsString,
  citationType: parseAsString,
  sentiment: parseAsString,
};

export function CitationListView() {
  return (
    <ErrorBoundary>
      <CitationListContent />
    </ErrorBoundary>
  );
}

function CitationListContent() {
  const t = useTranslations('citations');
  const locale = useLocale();
  const router = useRouter();

  // Citation-specific URL params
  const [citationParams, setCitationParams] = useQueryStates(citationFilterParsers, {
    shallow: false,
  });

  const {
    data,
    meta,
    isLoading,
    isError,
    params,
    setParams,
    resetParams: resetTableParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = usePaginatedQuery<CitationRecord>({
    queryKey: (p) => queryKeys.citations.list({ ...p, ...citationParams }),
    queryFn: (p) => fetchCitations({ ...p, ...citationParams }),
    defaultSort: 'createdAt',
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const onViewDetail = useCallback(
    (citation: CitationRecord) => {
      router.push(`/${locale}/citations/${citation.id}`);
    },
    [router, locale]
  );

  const columns = useCitationColumns({ onViewDetail });

  const hasFilters = !!(
    params.search ||
    citationParams.brandId ||
    citationParams.platformId ||
    citationParams.citationType ||
    citationParams.sentiment ||
    params.from ||
    params.to
  );
  const isEmpty = meta.total === 0 && !hasFilters && !isLoading;

  const currentFilters: CitationListFilters = useMemo(
    () => ({
      brandId: citationParams.brandId ?? undefined,
      platformId: citationParams.platformId ?? undefined,
      citationType: citationParams.citationType as CitationListFilters['citationType'],
      sentiment: citationParams.sentiment as CitationListFilters['sentiment'],
      from: params.from?.toISOString(),
      to: params.to?.toISOString(),
      search: params.search ?? undefined,
    }),
    [citationParams, params.from, params.to, params.search]
  );

  const resetAllFilters = useCallback(() => {
    resetTableParams();
    setCitationParams({
      brandId: null,
      platformId: null,
      citationType: null,
      sentiment: null,
    });
  }, [resetTableParams, setCitationParams]);

  // Merge setParams for filters component
  const setAllParams = useCallback(
    (updates: Record<string, unknown>) => {
      const citationKeys = new Set(['brandId', 'platformId', 'citationType', 'sentiment']);
      const citationUpdates: Record<string, string | null> = {};
      const tableUpdates: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(updates)) {
        if (citationKeys.has(key)) {
          citationUpdates[key] = (value as string | null) ?? null;
        } else {
          tableUpdates[key] = value;
        }
      }

      if (Object.keys(citationUpdates).length > 0) {
        setCitationParams(citationUpdates as Parameters<typeof setCitationParams>[0]);
      }
      if (Object.keys(tableUpdates).length > 0) {
        setParams(tableUpdates);
      }
    },
    [setCitationParams, setParams]
  );

  const allParams = useMemo(() => ({ ...params, ...citationParams }), [params, citationParams]);

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="section" onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="type-page">{t('list.title')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('list.resultCount', { total: meta.total })}
            </span>
          )}
        </div>
        <ExportCitationsButton
          filters={currentFilters}
          totalCount={meta.total}
          disabled={meta.total === 0}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={FileSearch}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <>
          {/* Filter bar */}
          <CitationFilters
            params={allParams}
            setParams={setAllParams}
            resetParams={resetAllFilters}
          />

          {/* No results with filters */}
          {meta.total === 0 && hasFilters && !isLoading ? (
            <EmptyState
              variant="inline"
              icon={FileSearch}
              title={t('empty.noResults')}
              action={{
                label: t('empty.clearFilters'),
                onClick: resetAllFilters,
              }}
            />
          ) : showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={7} rows={10} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              pageCount={Math.ceil(meta.total / meta.limit)}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
          )}

          {/* Pagination */}
          {meta.total > 0 && (
            <DataTablePagination
              page={meta.page}
              limit={meta.limit}
              total={meta.total}
              onPageChange={(page) => setParams({ page })}
              onLimitChange={(limit) => setParams({ limit })}
            />
          )}
        </>
      )}
    </div>
  );
}
