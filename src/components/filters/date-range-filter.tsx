'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  from?: Date;
  to?: Date;
  onChange: (range: { from?: Date; to?: Date }) => void;
  label?: string;
}

export function DateRangeFilter({ from, to, onChange, label }: DateRangeFilterProps) {
  const t = useTranslations('ui');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const displayText =
    from && to
      ? `${dateFormatter.format(from)} – ${dateFormatter.format(to)}`
      : from
        ? `${dateFormatter.format(from)} –`
        : (label ?? t('filters.dateRange.label'));

  const applyPreset = (days: number) => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - days);
    onChange({ from: start, to: now });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-7 gap-1.5', (from || to) && 'text-foreground')}
          aria-label={label ?? t('filters.dateRange.label')}
        >
          <CalendarDays className="size-3.5" />
          <span className="text-xs">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-1 border-b border-border p-2">
          <Button variant="ghost" size="xs" onClick={() => applyPreset(7)}>
            {t('filters.dateRange.last7')}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => applyPreset(30)}>
            {t('filters.dateRange.last30')}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => applyPreset(90)}>
            {t('filters.dateRange.last90')}
          </Button>
        </div>
        <Calendar
          mode="range"
          selected={from && to ? { from, to } : undefined}
          onSelect={(range) => {
            if (range) {
              onChange({ from: range.from, to: range.to });
              if (range.from && range.to) {
                setOpen(false);
              }
            }
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
