'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';
import { Switch } from '@/components/ui/switch';

import type { AlertRule, NameLookup } from '../alerts.types';
import { AlertSeverityBadge } from './alert-severity-badge';

/** Map snake_case metric keys to camelCase i18n keys. */
const METRIC_I18N_KEY: Record<string, string> = {
  recommendation_share: 'recommendationShare',
  citation_count: 'citationCount',
  sentiment_score: 'sentimentScore',
  position_average: 'positionAverage',
};

const CONDITION_I18N_KEY: Record<string, string> = {
  drops_below: 'dropsBelow',
  exceeds: 'exceeds',
  changes_by_percent: 'changesByPercent',
  changes_by_absolute: 'changesByAbsolute',
};

interface UseAlertRuleColumnsCallbacks {
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  onToggleEnabled: (rule: AlertRule) => void;
  brandNames: NameLookup;
  promptSetNames: NameLookup;
}

export function useAlertRuleColumns({
  onEdit,
  onDelete,
  onToggleEnabled,
  brandNames,
  promptSetNames,
}: UseAlertRuleColumnsCallbacks): ColumnDef<AlertRule>[] {
  const t = useTranslations('alerts');
  const tUi = useTranslations('ui');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<AlertRule>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('form.name')} />,
        cell: ({ row }) => {
          const rule = row.original;
          return (
            <div>
              <p className="font-medium text-foreground truncate max-w-[200px]" title={rule.name}>
                {rule.name}
              </p>
              {rule.description && (
                <p className="type-caption text-muted-foreground truncate max-w-[200px]">
                  {rule.description}
                </p>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'metric',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('form.metric')}</span>
        ),
        cell: ({ row }) => {
          const metricKey = METRIC_I18N_KEY[row.original.metric] ?? row.original.metric;
          return (
            <span className="type-caption text-muted-foreground">
              {t(`metric.${metricKey}` as never)}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'condition',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('form.condition')}</span>
        ),
        cell: ({ row }) => {
          const rule = row.original;
          const condKey = CONDITION_I18N_KEY[rule.condition] ?? rule.condition;
          return (
            <span className="type-caption text-muted-foreground">
              {t(`condition.${condKey}` as never)} {rule.threshold}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'scope',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('form.brand')}</span>
        ),
        cell: ({ row }) => {
          const rule = row.original;
          const brandName = brandNames[rule.scope.brandId];
          const promptSetName = promptSetNames[rule.promptSetId];
          return (
            <div>
              <p className="type-caption text-foreground">
                {brandName ?? (
                  <span className="font-mono text-xs">{rule.scope.brandId.slice(0, 12)}…</span>
                )}
              </p>
              <p className="type-caption text-muted-foreground">
                {promptSetName ?? (
                  <span className="font-mono text-xs">{rule.promptSetId.slice(0, 12)}…</span>
                )}
              </p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'severity',
        accessorKey: 'severity',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('form.severity')} />
        ),
        cell: ({ row }) => <AlertSeverityBadge severity={row.original.severity} size="sm" />,
        enableSorting: true,
      },
      {
        id: 'enabled',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('form.enabledLabel')}
          </span>
        ),
        cell: ({ row }) => {
          const rule = row.original;
          return (
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => onToggleEnabled(rule)}
              aria-label={rule.enabled ? t('rules.enabled') : t('rules.disabled')}
            />
          );
        },
        enableSorting: false,
      },
      {
        id: 'lastTriggeredAt',
        accessorKey: 'lastTriggeredAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('events.columns.triggered')} />
        ),
        cell: ({ row }) => {
          const val = row.original.lastTriggeredAt;
          if (!val) {
            return <span className="text-muted-foreground">{t('rules.never')}</span>;
          }
          const date = new Date(val);
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
        id: 'actions',
        header: () => <span className="sr-only">{t('events.columns.actions')}</span>,
        cell: ({ row }) => {
          const rule = row.original;
          return (
            <div className="flex justify-end">
              <DataTableRowActions
                actions={[
                  {
                    label: tUi('actions.edit'),
                    icon: Pencil,
                    onClick: () => onEdit(rule),
                  },
                  {
                    label: tUi('actions.delete'),
                    icon: Trash2,
                    onClick: () => onDelete(rule),
                    variant: 'destructive',
                  },
                ]}
              />
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [t, tUi, locale, onEdit, onDelete, onToggleEnabled, brandNames, promptSetNames]
  );
}
