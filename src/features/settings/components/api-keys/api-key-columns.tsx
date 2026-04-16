'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';
import { Badge } from '@/components/ui/badge';

import type { ApiKeyInfo } from '../../integrations.types';

const SCOPE_CONFIG: Record<
  string,
  { labelKey: string; variant: 'outline' | 'secondary' | 'default' }
> = {
  read: { labelKey: 'apiKeys.form.scopeOptions.read', variant: 'outline' },
  'read-write': { labelKey: 'apiKeys.form.scopeOptions.readWrite', variant: 'secondary' },
  admin: { labelKey: 'apiKeys.form.scopeOptions.admin', variant: 'default' },
};

interface UseApiKeyColumnsCallbacks {
  onRevoke: (key: ApiKeyInfo) => void;
  isAdmin: boolean;
}

export function useApiKeyColumns({
  onRevoke,
  isAdmin,
}: UseApiKeyColumnsCallbacks): ColumnDef<ApiKeyInfo>[] {
  const t = useTranslations('settings');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<ApiKeyInfo>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('apiKeys.columns.name')} />
        ),
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
        enableSorting: true,
      },
      {
        id: 'keyPrefix',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('apiKeys.columns.prefix')}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.keyPrefix}...
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'scope',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('apiKeys.columns.scope')}
          </span>
        ),
        cell: ({ row }) => {
          const config = SCOPE_CONFIG[row.original.scopes] ?? SCOPE_CONFIG.read;
          return <Badge variant={config.variant}>{t(config.labelKey as never)}</Badge>;
        },
        enableSorting: false,
      },
      {
        id: 'lastUsed',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('apiKeys.columns.lastUsed')}
          </span>
        ),
        cell: ({ row }) => {
          const lastUsed = row.original.lastUsedAt;
          if (!lastUsed) {
            return <span className="text-xs text-muted-foreground">{t('apiKeys.neverUsed')}</span>;
          }
          return (
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(lastUsed))}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'expires',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('apiKeys.columns.expires')}
          </span>
        ),
        cell: ({ row }) => {
          const expiresAt = row.original.expiresAt;
          if (!expiresAt) {
            return <span className="text-xs text-muted-foreground">{t('apiKeys.noExpiry')}</span>;
          }
          const isExpired = new Date(expiresAt) < new Date();
          return (
            <span className={`text-xs ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
              {isExpired && `${t('apiKeys.expired')} · `}
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(expiresAt))}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('apiKeys.columns.created')} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
            }).format(new Date(row.original.createdAt))}
          </span>
        ),
        enableSorting: true,
      },
      ...(isAdmin
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">{t('apiKeys.columns.actions')}</span>,
              cell: ({ row }: { row: { original: ApiKeyInfo } }) => (
                <div className="flex justify-end">
                  <DataTableRowActions
                    actions={[
                      {
                        label: t('apiKeys.revokeTitle'),
                        icon: Trash2,
                        onClick: () => onRevoke(row.original),
                        variant: 'destructive',
                      },
                    ]}
                  />
                </div>
              ),
              enableSorting: false,
            } as ColumnDef<ApiKeyInfo>,
          ]
        : []),
    ],
    [t, locale, onRevoke, isAdmin]
  );
}
