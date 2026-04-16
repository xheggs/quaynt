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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CoverageGapEntry } from '../crawler.types';

interface CoverageGapsTableProps {
  data: CoverageGapEntry[] | undefined;
  loading: boolean;
}

function getSeverityColor(daysSince: number): string {
  if (daysSince > 30) return 'text-red-600 dark:text-red-400';
  if (daysSince > 14) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export function CoverageGapsTable({ data, loading }: CoverageGapsTableProps) {
  const t = useTranslations('crawlerAnalytics');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('gapsTable.title')}</CardTitle>
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
                <TableHead>{t('gapsTable.path')}</TableHead>
                <TableHead>{t('gapsTable.lastCrawled')}</TableHead>
                <TableHead className="text-right">{t('gapsTable.daysSince')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((gap) => (
                <TableRow key={gap.path}>
                  <TableCell className="max-w-[300px] truncate font-mono text-sm">
                    {gap.path}
                  </TableCell>
                  <TableCell>
                    {gap.lastCrawled ? new Date(gap.lastCrawled).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell
                    className={cn('text-right tabular-nums', getSeverityColor(gap.daysSince))}
                  >
                    {gap.daysSince >= 0 ? gap.daysSince : '-'}
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
