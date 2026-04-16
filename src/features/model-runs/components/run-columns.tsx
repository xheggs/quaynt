'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';

import type { ModelRun, NameLookup } from '../model-run.types';
import { formatDuration } from '../lib/format-duration';
import { RunStatusBadge } from './run-status-badge';

interface UseRunColumnsCallbacks {
  onViewDetail: (run: ModelRun) => void;
  onCancel: (run: ModelRun) => void;
  brandNames: NameLookup;
  promptSetNames: NameLookup;
}

export function useRunColumns({
  onViewDetail,
  onCancel,
  brandNames,
  promptSetNames,
}: UseRunColumnsCallbacks): ColumnDef<ModelRun>[] {
  const t = useTranslations('modelRuns');
  const tUi = useTranslations('ui');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<ModelRun>[] => [
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.status')}</span>
        ),
        cell: ({ row }) => <RunStatusBadge status={row.original.status} size="sm" />,
        enableSorting: false,
      },
      {
        id: 'promptSetBrand',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('columns.promptSetBrand')}
          </span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          const promptSetName = promptSetNames[run.promptSetId];
          const brandName = brandNames[run.brandId];
          return (
            <div>
              <p className="font-medium text-foreground">
                {promptSetName ?? (
                  <span className="font-mono text-xs">{run.promptSetId.slice(0, 12)}…</span>
                )}
              </p>
              <p className="type-caption text-muted-foreground">
                {brandName ?? (
                  <span className="font-mono text-xs">{run.brandId.slice(0, 12)}…</span>
                )}
              </p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'progress',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.progress')}</span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          const done = run.totalResults - run.pendingResults;
          return (
            <span className="type-caption text-muted-foreground">
              {t('progress.fraction', { done, total: run.totalResults })}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.created')} />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
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
        id: 'duration',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.duration')}</span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          const dur = formatDuration(run.startedAt, run.completedAt, t as never);
          if (dur) {
            return <span className="type-caption text-muted-foreground">{dur}</span>;
          }
          if (run.startedAt && !run.completedAt) {
            return (
              <span className="type-caption text-muted-foreground">{t('detail.running')}</span>
            );
          }
          return <span className="text-muted-foreground">&mdash;</span>;
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => {
          const run = row.original;
          const isActive = run.status === 'pending' || run.status === 'running';
          const actions = [
            {
              label: tUi('actions.view'),
              icon: Eye,
              onClick: () => onViewDetail(run),
            },
            ...(isActive
              ? [
                  {
                    label: t('cancel.confirm'),
                    icon: XCircle,
                    onClick: () => onCancel(run),
                    variant: 'destructive' as const,
                  },
                ]
              : []),
          ];
          return (
            <div className="flex justify-end">
              <DataTableRowActions actions={actions} />
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [t, tUi, locale, onViewDetail, onCancel, brandNames, promptSetNames]
  );
}
