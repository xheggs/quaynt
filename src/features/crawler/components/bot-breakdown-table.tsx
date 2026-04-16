'use client';

import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { BotBreakdownEntry } from '../crawler.types';

interface BotBreakdownTableProps {
  data: BotBreakdownEntry[] | undefined;
  loading: boolean;
}

const categoryColors: Record<string, string> = {
  search: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  training: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  user_action: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function BotBreakdownTable({ data, loading }: BotBreakdownTableProps) {
  const t = useTranslations('crawlerAnalytics');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('botTable.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t('empty.description')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('botTable.name')}</TableHead>
                <TableHead>{t('botTable.operator')}</TableHead>
                <TableHead>{t('botTable.category')}</TableHead>
                <TableHead className="text-right">{t('botTable.visits')}</TableHead>
                <TableHead className="text-right">{t('botTable.uniquePages')}</TableHead>
                <TableHead>{t('botTable.lastSeen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((bot) => (
                <TableRow key={bot.botName}>
                  <TableCell className="font-medium">{bot.botName}</TableCell>
                  <TableCell>{bot.operator}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={categoryColors[bot.category] ?? ''}>
                      {t(
                        `category.${bot.category === 'user_action' ? 'userAction' : bot.category}` as never
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {bot.visits.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {bot.uniquePages.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {bot.lastSeen ? new Date(bot.lastSeen).toLocaleDateString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
