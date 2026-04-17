'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { GscTopQueryEntry } from '../traffic.api';

interface Props {
  data: GscTopQueryEntry[] | undefined;
  loading: boolean;
}

export function GscTopQueriesTable({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);
  const percentFormat = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const positionFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('gsc.topQueries.title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.query')}</th>
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.clicks')}</th>
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.impressions')}</th>
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.ctr')}</th>
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.position')}</th>
                  <th className="px-4 py-3 font-medium">{t('gsc.topQueries.citations')}</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => (
                  <tr key={row.query} className="border-b border-border last:border-0">
                    <td className="max-w-[320px] truncate px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{row.query}</span>
                        {row.aiCitationCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {t('gsc.topQueries.aiBadge')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{numberFormat.format(row.clicks)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {numberFormat.format(row.impressions)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{percentFormat.format(row.ctr)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {positionFormat.format(row.position)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {numberFormat.format(row.aiCitationCount)}
                    </td>
                  </tr>
                ))}
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {t('gsc.empty.description')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
