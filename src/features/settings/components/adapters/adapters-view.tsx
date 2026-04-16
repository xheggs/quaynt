'use client';

import { useCallback, useState } from 'react';
import { Plus, Puzzle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { authClient } from '@/modules/auth/auth.client';
import { queryKeys } from '@/lib/query/keys';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { AdapterConfig } from '../../integrations.types';
import { updateAdapter } from '../../integrations.api';
import { useWorkspaceQuery } from '../../use-settings-query';
import { useAdaptersQuery } from '../../use-integrations-query';
import { useAdapterColumns } from './adapter-columns';
import { AdapterFormDialog } from './adapter-form-dialog';
import { DeleteAdapterDialog } from './delete-adapter-dialog';

export function AdaptersView() {
  return (
    <ErrorBoundary>
      <AdaptersContent />
    </ErrorBoundary>
  );
}

function AdaptersContent() {
  const t = useTranslations('settings');
  const session = authClient.useSession();
  const workspaceQuery = useWorkspaceQuery();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editAdapter, setEditAdapter] = useState<AdapterConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdapterConfig | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    params,
    setParams,
  } = useAdaptersQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  const isAdmin = session.data?.user?.id === workspaceQuery.data?.ownerId;

  // Optimistic toggle for enabled/disabled
  const toggleMutation = useApiMutation<AdapterConfig, { id: string; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => updateAdapter(id, { enabled }),
    invalidateKeys: [queryKeys.adapters.lists()],
  });

  const onToggleEnabled = useCallback(
    (adapter: AdapterConfig) => {
      // Optimistic update
      queryClient.setQueryData(
        queryKeys.adapters.list({ ...params }),
        (old: { data: AdapterConfig[]; meta: typeof meta } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((a) => (a.id === adapter.id ? { ...a, enabled: !a.enabled } : a)),
          };
        }
      );
      toggleMutation.mutate({ id: adapter.id, enabled: !adapter.enabled });
    },
    [queryClient, params, toggleMutation]
  );

  const onEdit = useCallback((adapter: AdapterConfig) => setEditAdapter(adapter), []);
  const onDelete = useCallback((adapter: AdapterConfig) => setDeleteTarget(adapter), []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onHealthCheck = useCallback((_adapter: AdapterConfig) => {
    // Health check is handled inline via the AdapterHealthCheck component
    // in the row actions. For now, this is a placeholder callback.
  }, []);

  const columns = useAdapterColumns({
    onEdit,
    onDelete,
    onToggleEnabled,
    onHealthCheck,
    isAdmin,
  });

  const isEmpty = meta.total === 0 && !isLoading;

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
          <h1 className="type-section">{t('adapters.title')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('adapters.count', { count: meta.total })}
            </span>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('adapters.add')}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t('adapters.description')}</p>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Puzzle}
          title={t('adapters.empty.title')}
          description={t('adapters.empty.description')}
          action={
            isAdmin
              ? {
                  label: t('adapters.empty.cta'),
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={5} rows={4} />
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
      <AdapterFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AdapterFormDialog
        adapter={editAdapter}
        open={!!editAdapter}
        onOpenChange={(open) => {
          if (!open) setEditAdapter(null);
        }}
      />
      <DeleteAdapterDialog
        adapter={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
