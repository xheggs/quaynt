'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DualQueryRow, GapSignal } from '../dual-score.types';

interface GapQueryTableProps {
  rows: DualQueryRow[] | undefined;
  isLoading: boolean;
  gapSignal: GapSignal | undefined;
  onGapSignalChange: (signal: GapSignal | undefined) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ALL_VALUE = '__all__';
const GAP_SIGNALS: GapSignal[] = ['high_seo_no_ai', 'high_ai_no_seo', 'balanced', 'no_signal'];

function BadgeForSignal({ signal }: { signal: GapSignal }) {
  const t = useTranslations('dualScore');
  const tone: Record<GapSignal, string> = {
    high_seo_no_ai: 'border-amber-500 text-amber-700 dark:text-amber-400',
    high_ai_no_seo: 'border-sky-500 text-sky-700 dark:text-sky-400',
    balanced: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
    no_signal: 'border-muted-foreground text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={tone[signal]}>
      {t(`queries.gapSignal.${signal}` as 'queries.gapSignal.balanced')}
    </Badge>
  );
}

function formatPct(value: number | null, digits = 1): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(1);
}

export function GapQueryTable({
  rows,
  isLoading,
  gapSignal,
  onGapSignalChange,
  page,
  totalPages,
  onPageChange,
}: GapQueryTableProps) {
  const t = useTranslations('dualScore');
  const [selectValue, setSelectValue] = useState<string>(gapSignal ?? ALL_VALUE);

  const handleSelect = (value: string) => {
    setSelectValue(value);
    onGapSignalChange(value === ALL_VALUE ? undefined : (value as GapSignal));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <h2 className="text-base font-semibold">{t('queries.title')}</h2>
          <p className="text-muted-foreground text-xs">{t('queries.description')}</p>
        </div>
        <Select value={selectValue} onValueChange={handleSelect}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('queries.filter.all')}</SelectItem>
            {GAP_SIGNALS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`queries.gapSignal.${s}` as 'queries.gapSignal.balanced')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">…</p>
        ) : rows && rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase">
                <th className="py-2 pr-3 text-left">{t('queries.columns.query')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.impressions')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.clicks')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.ctr')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.avgPosition')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.aioCitations')}</th>
                <th className="py-2 pr-3 text-right">{t('queries.columns.brandMentionRate')}</th>
                <th className="py-2 text-left">{t('queries.columns.gapSignal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.query} className="border-t text-foreground">
                  <td className="py-2 pr-3">{r.query}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.impressions}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.clicks}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatPct(r.ctr, 1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatNumber(r.avgPosition)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.aioCitationCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatPct(r.brandMentionRate, 0)}
                  </td>
                  <td className="py-2">
                    <BadgeForSignal signal={r.gapSignal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-6 text-center">
            <p className="font-medium">{t('queries.empty.title')}</p>
            <p className="text-muted-foreground text-xs">{t('queries.empty.description')}</p>
          </div>
        )}
      </CardContent>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t p-3 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            ← {page - 1}
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            {page + 1} →
          </Button>
        </div>
      )}
    </Card>
  );
}
