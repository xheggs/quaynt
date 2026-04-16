'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface FilterBarProps {
  children: React.ReactNode;
  activeCount?: number;
  onClearAll?: () => void;
}

export function FilterBar({ children, activeCount, onClearAll }: FilterBarProps) {
  const t = useTranslations('ui');

  return (
    <div data-slot="filter-bar" className="flex flex-wrap items-center gap-2">
      {children}
      {activeCount != null && activeCount > 0 && onClearAll && (
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          {t('filters.clearAll')}
        </Button>
      )}
    </div>
  );
}
