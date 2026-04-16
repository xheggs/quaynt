'use client';

import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const t = useTranslations('ui');

  if (!column.getCanSort()) {
    return <span className="text-xs font-medium text-muted-foreground">{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      aria-label={sorted === 'asc' ? t('table.sortDescending') : t('table.sortAscending')}
    >
      <span
        className={cn('text-xs font-medium', sorted ? 'text-foreground' : 'text-muted-foreground')}
      >
        {title}
      </span>
      {sorted === 'asc' ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5" />
      )}
    </Button>
  );
}
