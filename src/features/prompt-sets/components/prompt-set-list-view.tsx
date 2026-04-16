'use client';

import { useCallback, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchFilter } from '@/components/filters/search-filter';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { PromptSet } from '../prompt-set.types';
import { fetchPromptSets } from '../prompt-set.api';
import { usePromptSetColumns } from './prompt-set-columns';
import { PromptSetFormDialog } from './prompt-set-form-dialog';
import { DeletePromptSetDialog } from './delete-prompt-set-dialog';

export function PromptSetListView() {
  return (
    <ErrorBoundary>
      <PromptSetListContent />
    </ErrorBoundary>
  );
}

function PromptSetListContent() {
  const t = useTranslations('promptSets');

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editPromptSet, setEditPromptSet] = useState<PromptSet | null>(null);
  const [deletePromptSet, setDeletePromptSet] = useState<PromptSet | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    params,
    setParams,
    resetParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = usePaginatedQuery<PromptSet>({
    queryKey: (p) => queryKeys.promptSets.list({ ...p }),
    queryFn: (p) => fetchPromptSets(p),
    defaultSort: 'createdAt',
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const onEdit = useCallback((ps: PromptSet) => setEditPromptSet(ps), []);
  const onDelete = useCallback((ps: PromptSet) => setDeletePromptSet(ps), []);
  const columns = usePromptSetColumns({ onEdit, onDelete });

  const hasSearch = !!params.search;
  const isEmpty = meta.total === 0 && !hasSearch && !isLoading;

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
          <h1 className="type-page">{t('labels.promptSets')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('labels.count', { count: meta.total })}
            </span>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('create.button')}
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={FileText}
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
          <FilterBar activeCount={hasSearch ? 1 : 0} onClearAll={resetParams}>
            <SearchFilter
              value={params.search ?? ''}
              onChange={(search) => setParams({ search: search || null })}
              placeholder={t('list.search')}
            />
          </FilterBar>

          {/* Table */}
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={4} rows={10} />
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
      <PromptSetFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
      <PromptSetFormDialog
        mode="edit"
        promptSet={editPromptSet ?? undefined}
        open={!!editPromptSet}
        onOpenChange={(open) => {
          if (!open) setEditPromptSet(null);
        }}
      />
      <DeletePromptSetDialog
        promptSet={deletePromptSet}
        open={!!deletePromptSet}
        onOpenChange={(open) => {
          if (!open) setDeletePromptSet(null);
        }}
      />
    </div>
  );
}
