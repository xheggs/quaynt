'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';

import type { Brand } from '../brand.types';

interface UseBrandColumnsCallbacks {
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
}

export function useBrandColumns({
  onEdit,
  onDelete,
}: UseBrandColumnsCallbacks): ColumnDef<Brand>[] {
  const t = useTranslations('brands');
  const tUi = useTranslations('ui');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<Brand>[] => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fields.name')} />,
        cell: ({ row }) => {
          const brand = row.original;
          return (
            <div>
              <Link
                href={`/${locale}/brands/${brand.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {brand.name}
              </Link>
              {brand.domain && <p className="type-caption text-muted-foreground">{brand.domain}</p>}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'aliases',
        accessorKey: 'aliases',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('fields.aliases')}</span>
        ),
        cell: ({ row }) => {
          const aliases = row.original.aliases;
          if (!aliases.length) {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
          const visible = aliases.slice(0, 3);
          const overflow = aliases.length - 3;
          return (
            <div className="flex flex-wrap gap-1">
              {visible.map((alias) => (
                <Badge key={alias} variant="secondary" className="text-xs">
                  {alias}
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
          const brand = row.original;
          return (
            <div className="flex justify-end">
              <DataTableRowActions
                actions={[
                  {
                    label: tUi('actions.edit'),
                    icon: Pencil,
                    onClick: () => onEdit(brand),
                  },
                  {
                    label: tUi('actions.delete'),
                    icon: Trash2,
                    onClick: () => onDelete(brand),
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
