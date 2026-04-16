'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';

import type { ReportSchedule } from '../reports.types';
import { deriveScheduleStatus } from '../reports.types';
import { describeCron } from '../reports.utils';
import { ReportFormatBadge } from './report-format-badge';

interface UseScheduleColumnsCallbacks {
  onEdit: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
  onToggleEnabled: (schedule: ReportSchedule) => void;
  onTrigger: (schedule: ReportSchedule) => void;
}

export function useScheduleColumns({
  onEdit,
  onDelete,
  onToggleEnabled,
  onTrigger,
}: UseScheduleColumnsCallbacks): ColumnDef<ReportSchedule>[] {
  const t = useTranslations('reports');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<ReportSchedule>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('schedules.columns.name')} />
        ),
        cell: ({ row }) => {
          const schedule = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={schedule.name}>
                {schedule.name}
              </p>
              {schedule.description && (
                <p className="truncate type-caption text-muted-foreground">
                  {schedule.description}
                </p>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'schedule',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('schedules.columns.schedule')}
          </span>
        ),
        cell: ({ row }) => (
          <span className="type-caption text-muted-foreground">
            {describeCron(row.original.schedule, locale)}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'recipients',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('schedules.columns.recipients')}
          </span>
        ),
        cell: ({ row }) => {
          const recipients = row.original.recipients;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">
                  {t('schedules.recipientCount', {
                    count: recipients.length,
                  })}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="space-y-0.5 text-xs">
                  {recipients.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          );
        },
        enableSorting: false,
      },
      {
        id: 'format',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('schedules.columns.format')}
          </span>
        ),
        cell: ({ row }) => <ReportFormatBadge format={row.original.format} />,
        enableSorting: false,
      },
      {
        id: 'lastDeliveredAt',
        accessorKey: 'lastDeliveredAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('schedules.columns.lastDelivered')} />
        ),
        cell: ({ row }) => {
          const date = row.original.lastDeliveredAt;
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
        enableSorting: true,
      },
      {
        id: 'nextRunAt',
        accessorKey: 'nextRunAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('schedules.columns.nextRun')} />
        ),
        cell: ({ row }) => {
          const schedule = row.original;
          if (!schedule.enabled || !schedule.nextRunAt)
            return <span className="type-caption text-muted-foreground">—</span>;
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(schedule.nextRunAt))}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('schedules.columns.status')}
          </span>
        ),
        cell: ({ row }) => {
          const schedule = row.original;
          const status = deriveScheduleStatus(schedule);

          if (status === 'disabled') {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive">{t('schedules.status.disabled')}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {t('schedules.disabledReason', {
                    count: schedule.consecutiveFailures,
                  })}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Switch
              checked={schedule.enabled}
              onCheckedChange={() => onToggleEnabled(schedule)}
              aria-label={schedule.enabled ? t('schedules.status.active') : t('schedules.paused')}
            />
          );
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('schedules.columns.actions')}</span>,
        cell: ({ row }) => {
          const schedule = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('schedules.columns.actions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(schedule)}>
                  <Pencil className="mr-2 size-4" />
                  {t('form.editTitle')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTrigger(schedule)}>
                  <Play className="mr-2 size-4" />
                  {t('schedules.triggerNow')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(schedule)}
                >
                  <Trash2 className="mr-2 size-4" />
                  {t('schedules.deleteTitle')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [t, locale, onEdit, onDelete, onToggleEnabled, onTrigger]
  );
}
