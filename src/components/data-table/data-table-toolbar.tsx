'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DataTableToolbarProps {
  children: React.ReactNode;
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  className?: string;
}

export function DataTableToolbar({
  children,
  selectedCount,
  bulkActions,
  className,
}: DataTableToolbarProps) {
  const t = useTranslations('ui');

  return (
    <div
      data-slot="data-table-toolbar"
      className={cn('flex flex-wrap items-center justify-between gap-2', className)}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex items-center gap-2">
        {selectedCount != null && selectedCount > 0 && (
          <>
            <Badge variant="secondary">{t('table.selected', { count: selectedCount })}</Badge>
            {bulkActions}
          </>
        )}
      </div>
    </div>
  );
}
