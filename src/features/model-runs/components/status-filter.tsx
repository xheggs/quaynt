'use client';

import { useTranslations } from 'next-intl';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ModelRunStatus } from '../model-run.types';

interface StatusFilterProps {
  value: string | null;
  onChange: (status: string | null) => void;
}

const STATUSES: ModelRunStatus[] = [
  'pending',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
];

const statusDotColors: Record<string, string> = {
  pending: 'bg-muted-foreground/50',
  running: 'bg-blue-500',
  completed: 'bg-green-500 dark:bg-green-400',
  partial: 'bg-amber-500 dark:bg-amber-400',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground/30',
};

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const t = useTranslations('modelRuns');

  return (
    <Select value={value ?? 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[160px]" aria-label={t('filters.status')}>
        <SelectValue placeholder={t('filters.allStatuses')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
        {STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${statusDotColors[status]}`} />
              {t(`status.${status}` as never)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
