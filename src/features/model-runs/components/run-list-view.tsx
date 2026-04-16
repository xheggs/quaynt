'use client';

import { useCallback, useMemo, useState } from 'react';
import { Play, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { ModelRun, NameLookup } from '../model-run.types';
import { isTerminalStatus } from '../model-run.types';
import { fetchModelRuns } from '../model-run.api';
import { fetchBrands } from '@/features/brands/brand.api';
import { fetchPromptSets } from '@/features/prompt-sets/prompt-set.api';
import { useRunColumns } from './run-columns';
import { NewRunDialog } from './new-run-dialog';
import { CancelRunDialog } from './cancel-run-dialog';
import { StatusFilter } from './status-filter';

export function ModelRunListView() {
  return (
    <ErrorBoundary>
      <ModelRunListContent />
    </ErrorBoundary>
  );
}

function ModelRunListContent() {
  const t = useTranslations('modelRuns');
  const locale = useLocale();
  const router = useRouter();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelRunId, setCancelRunId] = useState<string | null>(null);

  // Status filter (URL-synced via table params would be ideal, but keeping simple for now)
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    setParams,
    resetParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = usePaginatedQuery<ModelRun>({
    queryKey: (p) => queryKeys.modelRuns.list({ ...p, status: statusFilter }),
    queryFn: (p) => fetchModelRuns({ ...p, status: statusFilter ?? undefined }),
    defaultSort: 'createdAt',
    refetchInterval: (query: unknown) => {
      const q = query as { state?: { data?: { data?: ModelRun[] } } };
      const runs = q.state?.data?.data ?? [];
      const hasActive = runs.some((r) => !isTerminalStatus(r.status));
      return hasActive ? 5000 : false;
    },
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Name resolution
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchBrands({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const { data: promptSetsData } = useQuery({
    queryKey: queryKeys.promptSets.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchPromptSets({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const brandNames: NameLookup = useMemo(() => {
    const map: NameLookup = {};
    for (const b of brandsData?.data ?? []) {
      map[b.id] = b.name;
    }
    return map;
  }, [brandsData]);

  const promptSetNames: NameLookup = useMemo(() => {
    const map: NameLookup = {};
    for (const ps of promptSetsData?.data ?? []) {
      map[ps.id] = ps.name;
    }
    return map;
  }, [promptSetsData]);

  const onViewDetail = useCallback(
    (run: ModelRun) => router.push(`/${locale}/model-runs/${run.id}`),
    [router, locale]
  );
  const onCancel = useCallback((run: ModelRun) => setCancelRunId(run.id), []);
  const columns = useRunColumns({ onViewDetail, onCancel, brandNames, promptSetNames });

  const hasFilters = !!statusFilter;
  const isEmpty = meta.total === 0 && !hasFilters && !isLoading;

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
              {t('labels.count', { count: meta.total })}
            </span>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Play className="size-4" />
          {t('empty.addFirst')}
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Zap}
          title={t('empty.title')}
          description={t('empty.description')}
          action={{
            label: t('empty.addFirst'),
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <>
          {/* Filter bar */}
          <FilterBar
            activeCount={hasFilters ? 1 : 0}
            onClearAll={() => {
              setStatusFilter(null);
              resetParams();
            }}
          >
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          </FilterBar>

          {/* Table */}
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={6} rows={10} />
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

      {/* Dialogs */}
      <NewRunDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(runId) => router.push(`/${locale}/model-runs/${runId}`)}
      />
      <CancelRunDialog
        runId={cancelRunId}
        open={!!cancelRunId}
        onOpenChange={(open) => {
          if (!open) setCancelRunId(null);
        }}
      />
    </div>
  );
}
