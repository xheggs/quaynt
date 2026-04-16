'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { Button } from '@/components/ui/button';

import type { AlertEvent } from '../alerts.types';
import { deriveEventStatus } from '../alerts.types';
import { AlertSeverityBadge } from './alert-severity-badge';
import { AlertStatusBadge } from './alert-status-badge';
import { SnoozePopover } from './snooze-popover';

interface UseAlertEventColumnsCallbacks {
  onAcknowledge: (event: AlertEvent) => void;
}

export function useAlertEventColumns({
  onAcknowledge,
}: UseAlertEventColumnsCallbacks): ColumnDef<AlertEvent>[] {
  const t = useTranslations('alerts');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<AlertEvent>[] => [
      {
        id: 'severity',
        accessorKey: 'severity',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('events.columns.severity')} />
        ),
        cell: ({ row }) => <AlertSeverityBadge severity={row.original.severity} size="sm" />,
        enableSorting: true,
      },
      {
        id: 'ruleName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('events.columns.rule')} />
        ),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <span className="text-sm text-foreground">
              {event.ruleName ?? (
                <span className="font-mono text-xs text-muted-foreground">
                  {event.alertRuleId.slice(0, 12)}…
                </span>
              )}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'metricValue',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('events.columns.metric')}
          </span>
        ),
        cell: ({ row }) => {
          const event = row.original;
          return (
            <span className="type-caption tabular-nums text-muted-foreground">
              {event.previousValue
                ? t('events.valueSummary', {
                    value: event.metricValue,
                    previous: event.previousValue,
                  })
                : event.metricValue}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'brand',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('events.columns.brand')}
          </span>
        ),
        cell: ({ row }) => {
          const brandName = row.original.scopeSnapshot.brandName;
          return <span className="type-caption text-muted-foreground">{brandName ?? '—'}</span>;
        },
        enableSorting: false,
      },
      {
        id: 'triggeredAt',
        accessorKey: 'triggeredAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('events.columns.triggered')} />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.triggeredAt);
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('events.columns.status')} />
        ),
        cell: ({ row }) => {
          const status = deriveEventStatus(row.original);
          return <AlertStatusBadge status={status} size="sm" />;
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('events.columns.actions')}</span>,
        cell: ({ row }) => {
          const event = row.original;
          const isAcknowledged = !!event.acknowledgedAt;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => onAcknowledge(event)}
                disabled={isAcknowledged}
                title={t('events.acknowledge')}
              >
                <Check className="size-3.5" />
                <span className="sr-only">{t('events.acknowledge')}</span>
              </Button>
              <SnoozePopover eventId={event.id} disabled={isAcknowledged} />
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [t, locale, onAcknowledge]
  );
}
