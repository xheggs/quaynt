'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import type { WebhookDelivery } from '../../integrations.types';
import { useWebhookDeliveriesQuery } from '../../use-integrations-query';

interface WebhookDeliveriesDialogProps {
  webhookId: string | null;
  webhookUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive'; className?: string }
> = {
  pending: { variant: 'default', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  success: { variant: 'default', className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  failed: { variant: 'destructive' },
};

export function WebhookDeliveriesDialog({
  webhookId,
  webhookUrl,
  open,
  onOpenChange,
}: WebhookDeliveriesDialogProps) {
  const t = useTranslations('settings');
  const locale = useLocale();

  const {
    data,
    meta,
    isLoading,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    setParams,
  } = useWebhookDeliveriesQuery(open ? webhookId : null);

  const { showSkeleton } = useDelayedLoading(isLoading);

  const columns = useMemo(
    (): ColumnDef<WebhookDelivery>[] => [
      {
        id: 'eventType',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.deliveries.columns.event')}
          </span>
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.eventType}</span>,
        enableSorting: false,
      },
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.deliveries.columns.status')}
          </span>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
          return (
            <Badge variant={config.variant} className={config.className}>
              {t(`webhooks.deliveries.statusLabels.${status}` as never)}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'httpStatus',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.deliveries.columns.httpStatus')}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.httpStatus ?? '\u2014'}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'latency',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.deliveries.columns.latency')}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.responseLatencyMs != null
              ? `${row.original.responseLatencyMs}ms`
              : '\u2014'}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('webhooks.deliveries.columns.time')} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(row.original.createdAt))}
          </span>
        ),
        enableSorting: true,
      },
    ],
    [t, locale]
  );

  const truncatedUrl = webhookUrl.length > 50 ? `${webhookUrl.slice(0, 50)}...` : webhookUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t('webhooks.deliveries.title')}</DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">{truncatedUrl}</p>
        </DialogHeader>

        {showSkeleton ? (
          <div className="rounded-md border border-border">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState variant="inline" title={t('webhooks.deliveries.empty')} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              pageCount={Math.ceil(meta.total / meta.limit)}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />

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
      </DialogContent>
    </Dialog>
  );
}
