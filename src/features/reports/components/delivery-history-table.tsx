'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import type { DeliveryStatus, ReportDelivery } from '../reports.types';
import { useScheduleDeliveriesQuery } from '../use-reports-query';

interface DeliveryHistoryTableProps {
  scheduleId: string;
}

const deliveryStatusConfig: Record<
  DeliveryStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { variant: 'outline' },
  sent: { variant: 'default' },
  failed: { variant: 'destructive' },
};

export function DeliveryHistoryTable({ scheduleId }: DeliveryHistoryTableProps) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const { data, isLoading, pagination, onPaginationChange, sorting, onSortingChange, meta } =
    useScheduleDeliveriesQuery(scheduleId, { limit: 5 });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const columns = useMemo(
    (): ColumnDef<ReportDelivery>[] => [
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('deliveries.columns.status')}
          </span>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const config = deliveryStatusConfig[status];
          return (
            <Badge variant={config.variant}>{t(`deliveries.status.${status}` as never)}</Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'sentAt',
        accessorKey: 'sentAt',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('deliveries.columns.sentAt')}
          </span>
        ),
        cell: ({ row }) => {
          const date = row.original.sentAt;
          if (!date) return <span className="type-caption text-muted-foreground">—</span>;
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(date))}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'recipientCount',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('deliveries.columns.recipientCount')}
          </span>
        ),
        cell: ({ row }) => (
          <span className="type-caption tabular-nums text-muted-foreground">
            {row.original.recipientCount}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'failureReason',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('deliveries.columns.failureReason')}
          </span>
        ),
        cell: ({ row }) => {
          const reason = row.original.failureReason;
          if (!reason) return <span className="type-caption text-muted-foreground">—</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[200px] truncate type-caption text-destructive">
                  {reason}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs">{reason}</p>
              </TooltipContent>
            </Tooltip>
          );
        },
        enableSorting: false,
      },
    ],
    [t, locale]
  );

  if (!showSkeleton && data.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{t('deliveries.empty')}</p>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      isLoading={showSkeleton}
    />
  );
}
