'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';

import type { ReportTemplate } from '../reports.types';
import { REPORT_SECTIONS } from '../reports.types';

interface UseTemplateColumnsCallbacks {
  onEdit: (template: ReportTemplate) => void;
  onDuplicate: (template: ReportTemplate) => void;
  onDelete: (template: ReportTemplate) => void;
  onPreview: (template: ReportTemplate) => void;
}

export function useTemplateColumns({
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
}: UseTemplateColumnsCallbacks): ColumnDef<ReportTemplate>[] {
  const t = useTranslations('reportsTemplates');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<ReportTemplate>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} />,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              {template.branding.logoUrl && (
                <img
                  src={template.branding.logoUrl}
                  alt=""
                  className="size-8 shrink-0 rounded object-contain"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={template.name}>
                  {template.name}
                </p>
                {template.description && (
                  <p className="truncate type-caption text-muted-foreground">
                    {template.description}
                  </p>
                )}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'sections',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.sections')}</span>
        ),
        cell: ({ row }) => {
          const sections = row.original.sections;
          const enabledCount = REPORT_SECTIONS.filter((s) => sections[s]).length;
          return (
            <Badge variant="secondary">
              {t('form.sectionsCount', {
                enabled: enabledCount,
                total: REPORT_SECTIONS.length,
              })}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'font',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.font')}</span>
        ),
        cell: ({ row }) => {
          const fontKey =
            row.original.branding.fontFamily === 'noto-serif'
              ? 'form.fontNotoSerif'
              : 'form.fontNotoSans';
          return <span className="type-caption text-muted-foreground">{t(fontKey)}</span>;
        },
        enableSorting: false,
      },
      {
        id: 'colors',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.colors')}</span>
        ),
        cell: ({ row }) => {
          const { primaryColor, secondaryColor, accentColor } = row.original.branding;
          const swatches = [
            { color: primaryColor, label: primaryColor },
            { color: secondaryColor, label: secondaryColor },
            { color: accentColor, label: accentColor },
          ];
          return (
            <div className="flex items-center gap-1.5">
              {swatches.map(({ color, label }) => (
                <Tooltip key={color + label}>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-block size-3 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
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
          const date = row.original.createdAt;
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
              }).format(new Date(date))}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('actions.edit')}</span>,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('actions.edit')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(template)}>
                  <Pencil className="mr-2 size-4" />
                  {t('actions.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPreview(template)}>
                  <Eye className="mr-2 size-4" />
                  {t('actions.preview')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(template)}>
                  <Copy className="mr-2 size-4" />
                  {t('actions.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(template)}
                >
                  <Trash2 className="mr-2 size-4" />
                  {t('actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [t, locale, onEdit, onDuplicate, onDelete, onPreview]
  );
}
