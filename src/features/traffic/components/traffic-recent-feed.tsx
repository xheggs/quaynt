'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { RecentVisitEntry } from '../traffic.types';
import { PLATFORM_DISPLAY_NAMES } from './platform-display';

interface Props {
  data: RecentVisitEntry[] | undefined;
  loading: boolean;
}

export function TrafficRecentFeed({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recent.title')}</CardTitle>
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
                <th className="px-4 py-3 font-medium">{t('recent.timestamp')}</th>
                <th className="px-4 py-3 font-medium">{t('recent.platform')}</th>
                <th className="px-4 py-3 font-medium">{t('recent.path')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dateFormat.format(new Date(row.visitedAt))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">
                        {PLATFORM_DISPLAY_NAMES[row.platform] ?? row.platform}
                      </Badge>
                      <Badge variant="outline">{t(`source.${row.source}`)}</Badge>
                    </div>
                  </td>
                  <td className="max-w-[420px] truncate px-4 py-3 font-mono text-xs">
                    {row.landingPath}
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
