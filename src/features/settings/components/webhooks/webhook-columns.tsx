'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, KeyRound, Pencil, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { WebhookEndpoint } from '../../integrations.types';
import { WebhookStatusBadge } from './webhook-status-badge';

interface UseWebhookColumnsCallbacks {
  onEdit: (webhook: WebhookEndpoint) => void;
  onDelete: (webhook: WebhookEndpoint) => void;
  onTest: (webhook: WebhookEndpoint) => void;
  onRotateSecret: (webhook: WebhookEndpoint) => void;
  onViewDeliveries: (webhook: WebhookEndpoint) => void;
  isAdmin: boolean;
}

export function useWebhookColumns({
  onEdit,
  onDelete,
  onTest,
  onRotateSecret,
  onViewDeliveries,
  isAdmin,
}: UseWebhookColumnsCallbacks): ColumnDef<WebhookEndpoint>[] {
  const t = useTranslations('settings');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<WebhookEndpoint>[] => [
      {
        id: 'url',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.columns.url')}
          </span>
        ),
        cell: ({ row }) => {
          const url = row.original.url;
          const truncated = url.length > 40 ? `${url.slice(0, 40)}...` : url;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default font-mono text-xs text-foreground">
                    {truncated}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{url}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
        enableSorting: false,
      },
      {
        id: 'events',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.columns.events')}
          </span>
        ),
        cell: ({ row }) => {
          const events = row.original.events;
          if (events.includes('*')) {
            return <Badge variant="secondary">{t('webhooks.form.allEvents')}</Badge>;
          }
          return (
            <Badge variant="outline">
              {t('webhooks.eventsSelected', { count: events.length })}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('webhooks.columns.status')}
          </span>
        ),
        cell: ({ row }) => <WebhookStatusBadge endpoint={row.original} />,
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('webhooks.columns.created')} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              new Date(row.original.createdAt)
            )}
          </span>
        ),
        enableSorting: true,
      },
      ...(isAdmin
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">{t('webhooks.columns.actions')}</span>,
              cell: ({ row }: { row: { original: WebhookEndpoint } }) => {
                const webhook = row.original;
                const actions = [
                  {
                    label: t('webhooks.test'),
                    icon: Send,
                    onClick: () => onTest(webhook),
                  },
                  {
                    label: t('webhooks.deliveries.title'),
                    icon: Eye,
                    onClick: () => onViewDeliveries(webhook),
                  },
                  {
                    label: t('webhooks.form.editTitle'),
                    icon: Pencil,
                    onClick: () => onEdit(webhook),
                  },
                  {
                    label: t('webhooks.secret.rotateTitle'),
                    icon: KeyRound,
                    onClick: () => onRotateSecret(webhook),
                    variant: 'destructive' as const,
                  },
                  {
                    label: t('webhooks.deleteTitle'),
                    icon: Trash2,
                    onClick: () => onDelete(webhook),
                    variant: 'destructive' as const,
                  },
                ];
                return (
                  <div className="flex justify-end">
                    <DataTableRowActions actions={actions} />
                  </div>
                );
              },
              enableSorting: false,
            } as ColumnDef<WebhookEndpoint>,
          ]
        : []),
    ],
    [t, locale, onEdit, onDelete, onTest, onRotateSecret, onViewDeliveries, isAdmin]
  );
}
