'use client';

import { useCallback, useState } from 'react';
import { Plus, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { authClient } from '@/modules/auth/auth.client';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { WebhookEndpoint } from '../../integrations.types';
import { testWebhook, deleteWebhook } from '../../integrations.api';
import { useWorkspaceQuery } from '../../use-settings-query';
import { useWebhooksQuery } from '../../use-integrations-query';
import { queryKeys } from '@/lib/query/keys';
import { useWebhookColumns } from './webhook-columns';
import { WebhookFormDialog } from './webhook-form-dialog';
import { RotateSecretDialog } from './rotate-secret-dialog';
import { WebhookDeliveriesDialog } from './webhook-deliveries-dialog';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

const MAX_WEBHOOKS = 10;

export function WebhooksView() {
  return (
    <ErrorBoundary>
      <WebhooksContent />
    </ErrorBoundary>
  );
}

function WebhooksContent() {
  const t = useTranslations('settings');
  const session = authClient.useSession();
  const workspaceQuery = useWorkspaceQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookEndpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);
  const [rotateTarget, setRotateTarget] = useState<WebhookEndpoint | null>(null);
  const [deliveriesTarget, setDeliveriesTarget] = useState<WebhookEndpoint | null>(null);

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
  } = useWebhooksQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  const isAdmin = session.data?.user?.id === workspaceQuery.data?.ownerId;
  const atMaxLimit = meta.total >= MAX_WEBHOOKS;

  const deleteMutation = useApiMutation<void, string>({
    mutationFn: (id) => deleteWebhook(id),
    invalidateKeys: [queryKeys.webhooks.lists()],
    successMessage: t('webhooks.deleteSuccess'),
    onSuccess: () => setDeleteTarget(null),
  });

  const testMutation = useApiMutation<{ eventId: string }, string>({
    mutationFn: (id) => testWebhook(id),
    successMessage: t('webhooks.testSuccess'),
  });

  const onEdit = useCallback((w: WebhookEndpoint) => setEditWebhook(w), []);
  const onDelete = useCallback((w: WebhookEndpoint) => setDeleteTarget(w), []);
  const onTest = useCallback(
    (w: WebhookEndpoint) => {
      if (w.enabled) testMutation.mutate(w.id);
    },
    [testMutation]
  );
  const onRotateSecret = useCallback((w: WebhookEndpoint) => setRotateTarget(w), []);
  const onViewDeliveries = useCallback((w: WebhookEndpoint) => setDeliveriesTarget(w), []);

  const columns = useWebhookColumns({
    onEdit,
    onDelete,
    onTest,
    onRotateSecret,
    onViewDeliveries,
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
          <h1 className="type-section">{t('webhooks.title')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('webhooks.count', { count: meta.total })}
            </span>
          )}
        </div>
        {isAdmin && !atMaxLimit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('webhooks.add')}
          </Button>
        )}
        {isAdmin && atMaxLimit && (
          <span className="text-sm text-muted-foreground">{t('webhooks.maxReached')}</span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t('webhooks.description')}</p>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Webhook}
          title={t('webhooks.empty.title')}
          description={t('webhooks.empty.description')}
          action={
            isAdmin
              ? {
                  label: t('webhooks.empty.cta'),
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={4} rows={3} />
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
      <WebhookFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <WebhookFormDialog
        webhook={editWebhook}
        open={!!editWebhook}
        onOpenChange={(open) => {
          if (!open) setEditWebhook(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('webhooks.deleteTitle')}
        description={t('webhooks.deleteConfirm')}
        confirmLabel={t('webhooks.deleteTitle')}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
      <RotateSecretDialog
        webhookId={rotateTarget?.id ?? null}
        open={!!rotateTarget}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null);
        }}
      />
      <WebhookDeliveriesDialog
        webhookId={deliveriesTarget?.id ?? null}
        webhookUrl={deliveriesTarget?.url ?? ''}
        open={!!deliveriesTarget}
        onOpenChange={(open) => {
          if (!open) setDeliveriesTarget(null);
        }}
      />
    </div>
  );
}
