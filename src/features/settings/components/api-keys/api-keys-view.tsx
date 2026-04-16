'use client';

import { useCallback, useState } from 'react';
import { Key, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { authClient } from '@/modules/auth/auth.client';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { ApiKeyInfo } from '../../integrations.types';
import { useWorkspaceQuery } from '../../use-settings-query';
import { useApiKeysQuery } from '../../use-integrations-query';
import { useApiKeyColumns } from './api-key-columns';
import { GenerateKeyDialog } from './generate-key-dialog';
import { RevokeKeyDialog } from './revoke-key-dialog';

export function ApiKeysView() {
  return (
    <ErrorBoundary>
      <ApiKeysContent />
    </ErrorBoundary>
  );
}

function ApiKeysContent() {
  const t = useTranslations('settings');
  const session = authClient.useSession();
  const workspaceQuery = useWorkspaceQuery();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyInfo | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    setParams,
  } = useApiKeysQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  const isAdmin = session.data?.user?.id === workspaceQuery.data?.ownerId;

  const onRevoke = useCallback((key: ApiKeyInfo) => setRevokeTarget(key), []);
  const columns = useApiKeyColumns({ onRevoke, isAdmin });

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
          <h1 className="type-section">{t('apiKeys.title')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('apiKeys.count', { count: meta.total })}
            </span>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="size-4" />
            {t('apiKeys.generate')}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t('apiKeys.description')}</p>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Key}
          title={t('apiKeys.empty.title')}
          description={t('apiKeys.empty.description')}
          action={
            isAdmin
              ? {
                  label: t('apiKeys.empty.cta'),
                  onClick: () => setGenerateOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={5} rows={3} />
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
      <GenerateKeyDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <RevokeKeyDialog
        apiKey={revokeTarget}
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      />
    </div>
  );
}
