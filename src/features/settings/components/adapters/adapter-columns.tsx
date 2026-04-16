'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Activity, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

import type { AdapterConfig } from '../../integrations.types';
import { SERP_ADAPTER_PLATFORMS } from '../../integrations.types';
import { AdapterHealthBadge } from './adapter-health-badge';
import { PlatformIcon } from './platform-icon';

interface UseAdapterColumnsCallbacks {
  onEdit: (adapter: AdapterConfig) => void;
  onDelete: (adapter: AdapterConfig) => void;
  onToggleEnabled: (adapter: AdapterConfig) => void;
  onHealthCheck: (adapter: AdapterConfig) => void;
  isAdmin: boolean;
}

export function useAdapterColumns({
  onEdit,
  onDelete,
  onToggleEnabled,
  onHealthCheck,
  isAdmin,
}: UseAdapterColumnsCallbacks): ColumnDef<AdapterConfig>[] {
  const t = useTranslations('settings');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<AdapterConfig>[] => [
      {
        id: 'platform',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('adapters.columns.platform')}
          </span>
        ),
        cell: ({ row }) => {
          const adapter = row.original;
          const platformName = t(`adapters.platformNames.${adapter.platformId}` as never);
          return (
            <div className="flex items-center gap-3">
              <PlatformIcon platform={adapter.platformId} size={24} />
              <div>
                <p className="font-medium text-foreground">{adapter.displayName}</p>
                <p className="text-xs text-muted-foreground">{platformName}</p>
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('adapters.columns.status')}
          </span>
        ),
        cell: ({ row }) => {
          const adapter = row.original;
          if (!isAdmin) {
            return (
              <span className="text-xs text-muted-foreground">
                {adapter.enabled ? t('adapters.enabled') : t('adapters.disabled')}
              </span>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={adapter.enabled}
                onCheckedChange={() => onToggleEnabled(adapter)}
                aria-label={adapter.enabled ? t('adapters.enabled') : t('adapters.disabled')}
              />
              <span className="text-xs text-muted-foreground">
                {adapter.enabled ? t('adapters.enabled') : t('adapters.disabled')}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'credentials',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('adapters.columns.displayName')}
          </span>
        ),
        cell: ({ row }) => {
          const adapter = row.original;
          return adapter.credentialsSet ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
              {t('adapters.credentialsSet')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {t('adapters.credentialsNotSet')}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'health',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('adapters.columns.health')}
          </span>
        ),
        cell: ({ row }) => (
          <AdapterHealthBadge
            status={row.original.lastHealthStatus as 'healthy' | 'degraded' | 'unhealthy' | null}
          />
        ),
        enableSorting: false,
      },
      {
        id: 'lastChecked',
        accessorKey: 'lastHealthCheckedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('adapters.columns.lastChecked')} />
        ),
        cell: ({ row }) => {
          const checkedAt = row.original.lastHealthCheckedAt;
          if (!checkedAt) {
            return (
              <span className="text-xs text-muted-foreground">
                {t('adapters.health.neverChecked')}
              </span>
            );
          }
          const date = new Date(checkedAt);
          return (
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      ...(isAdmin
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">{t('adapters.columns.actions')}</span>,
              cell: ({ row }: { row: { original: AdapterConfig } }) => {
                const adapter = row.original;
                const isSerpAdapter = (SERP_ADAPTER_PLATFORMS as readonly string[]).includes(
                  adapter.platformId
                );
                const actions = [
                  {
                    label: isSerpAdapter
                      ? `${t('adapters.health.check')} *`
                      : t('adapters.health.check'),
                    icon: Activity,
                    onClick: () => onHealthCheck(adapter),
                  },
                  {
                    label: t('adapters.form.editTitle'),
                    icon: Pencil,
                    onClick: () => onEdit(adapter),
                  },
                  {
                    label: t('adapters.deleteTitle'),
                    icon: Trash2,
                    onClick: () => onDelete(adapter),
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
            } as ColumnDef<AdapterConfig>,
          ]
        : []),
    ],
    [t, locale, onEdit, onDelete, onToggleEnabled, onHealthCheck, isAdmin]
  );
}
