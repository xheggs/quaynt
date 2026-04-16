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
import type { TopPageEntry } from '../crawler.types';

interface TopPagesTableProps {
  data: TopPageEntry[] | undefined;
  loading: boolean;
}

export function TopPagesTable({ data, loading }: TopPagesTableProps) {
  const t = useTranslations('crawlerAnalytics');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pagesTable.title')}</CardTitle>
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
                <TableHead>{t('pagesTable.path')}</TableHead>
                <TableHead className="text-right">{t('pagesTable.visits')}</TableHead>
                <TableHead className="text-right">{t('pagesTable.botCount')}</TableHead>
                <TableHead>{t('pagesTable.lastCrawled')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((page) => (
                <TableRow key={page.path}>
                  <TableCell className="max-w-[300px] truncate font-mono text-sm">
                    {page.path}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {page.totalVisits.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{page.botCount}</TableCell>
                  <TableCell>
                    {page.lastCrawled ? new Date(page.lastCrawled).toLocaleDateString() : '-'}
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
