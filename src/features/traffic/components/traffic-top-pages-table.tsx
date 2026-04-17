'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { TopPageEntry } from '../traffic.types';
import { PLATFORM_DISPLAY_NAMES } from './platform-display';

interface Props {
  data: TopPageEntry[] | undefined;
  loading: boolean;
}

export function TrafficTopPagesTable({ data, loading }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topPages.title')}</CardTitle>
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
                <th className="px-4 py-3 font-medium">{t('topPages.path')}</th>
                <th className="px-4 py-3 font-medium">{t('topPages.visits')}</th>
                <th className="px-4 py-3 font-medium">{t('topPages.platforms')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.path} className="border-b border-border last:border-0">
                  <td className="max-w-[420px] truncate px-4 py-3 font-mono text-xs">{row.path}</td>
                  <td className="px-4 py-3 tabular-nums">{numberFormat.format(row.visits)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.platforms.map((platform) => (
                        <Badge key={platform} variant="outline" className="text-xs">
                          {PLATFORM_DISPLAY_NAMES[platform] ?? platform}
                        </Badge>
                      ))}
                    </div>
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
