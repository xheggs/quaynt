'use client';

import { Bot, Eye, FileText, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyticsSummary } from '../crawler.types';

interface CrawlerKpiCardsProps {
  data: AnalyticsSummary | undefined;
  loading: boolean;
}

const kpiConfig = [
  { key: 'totalVisits' as const, icon: Eye },
  { key: 'uniqueBots' as const, icon: Bot },
  { key: 'uniquePages' as const, icon: FileText },
  { key: 'activeBots' as const, icon: Search },
] as const;

export function CrawlerKpiCards({ data, loading }: CrawlerKpiCardsProps) {
  const t = useTranslations('crawlerAnalytics');

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiConfig.map(({ key, icon: Icon }) => (
        <Card key={key} className="border-l-2 border-l-primary p-5">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" />
              <span>{t(`kpi.${key}` as never)}</span>
            </div>
            <div className="mt-2">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {data?.[key]?.toLocaleString() ?? '0'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
