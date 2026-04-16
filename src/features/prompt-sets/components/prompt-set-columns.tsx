'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';

import type { PromptSet } from '../prompt-set.types';

interface UsePromptSetColumnsCallbacks {
  onEdit: (promptSet: PromptSet) => void;
  onDelete: (promptSet: PromptSet) => void;
}

export function usePromptSetColumns({
  onEdit,
  onDelete,
}: UsePromptSetColumnsCallbacks): ColumnDef<PromptSet>[] {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<PromptSet>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fields.name')} />,
        cell: ({ row }) => {
          const ps = row.original;
          return (
            <div>
              <Link
                href={`/${locale}/prompt-sets/${ps.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {ps.name}
              </Link>
              {ps.description && (
                <p className="type-caption text-muted-foreground truncate max-w-[300px]">
                  {ps.description.length > 60 ? `${ps.description.slice(0, 60)}…` : ps.description}
                </p>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'tags',
        accessorKey: 'tags',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('fields.tags')}</span>
        ),
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (!tags.length) {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
          const visible = tags.slice(0, 3);
          const overflow = tags.length - 3;
          return (
            <div className="flex flex-wrap gap-1">
              {visible.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {overflow > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{overflow}
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('detail.created')} />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{tUi('actions.edit')}</span>,
        cell: ({ row }) => {
          const ps = row.original;
          return (
            <div className="flex justify-end">
              <DataTableRowActions
                actions={[
                  {
                    label: tUi('actions.edit'),
                    icon: Pencil,
                    onClick: () => onEdit(ps),
                  },
                  {
                    label: tUi('actions.delete'),
                    icon: Trash2,
                    onClick: () => onDelete(ps),
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
    [t, tUi, locale, onEdit, onDelete]
  );
}
