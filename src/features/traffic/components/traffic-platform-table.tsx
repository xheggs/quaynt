'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlatformBreakdownEntry } from '../traffic.types';

interface Props {
  data: PlatformBreakdownEntry[] | undefined;
  loading: boolean;
}

export function TrafficPlatformTable({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('platforms.title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">{t('platforms.platform')}</th>
                <th className="px-4 py-3 font-medium">{t('platforms.visits')}</th>
                <th className="px-4 py-3 font-medium">{t('platforms.uniquePages')}</th>
                <th className="px-4 py-3 font-medium">{t('platforms.lastVisit')}</th>
                <th className="px-4 py-3 font-medium">{t('platforms.trend')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => {
                const trend =
                  row.priorPeriodVisits === 0
                    ? row.visits > 0
                      ? 1
                      : 0
                    : (row.visits - row.priorPeriodVisits) / row.priorPeriodVisits;
                const TrendIcon = trend > 0.05 ? ArrowUp : trend < -0.05 ? ArrowDown : Minus;
                const trendColor =
                  trend > 0.05
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : trend < -0.05
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground';
                return (
                  <tr key={row.platform} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{row.displayName}</td>
                    <td className="px-4 py-3 tabular-nums">{numberFormat.format(row.visits)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {numberFormat.format(row.uniquePages)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.lastVisit ? dateFormat.format(new Date(row.lastVisit)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="size-4" />
                        <span className="tabular-nums">{Math.round(trend * 100)}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('empty.description')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
