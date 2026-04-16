'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BrandBenchmark } from '../benchmark.types';

type SortKey = 'rank' | 'brand' | 'share' | 'shareDelta' | 'citations';
type SortDir = 'asc' | 'desc';

interface BenchmarkTableProps {
  brands: BrandBenchmark[];
}

function RankChangeIndicator({ change }: { change: number | null }) {
  const t = useTranslations('benchmarks');

  if (change === null) {
    return (
      <Badge variant="outline" className="text-xs">
        {t('trend.rankNew')}
      </Badge>
    );
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-success">
        <ArrowUp className="size-3" aria-hidden="true" />
        {t('trend.rankUp', { count: change })}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-destructive">
        <ArrowDown className="size-3" aria-hidden="true" />
        {t('trend.rankDown', { count: Math.abs(change) })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="size-3" aria-hidden="true" />
      {t('trend.rankStable')}
    </span>
  );
}

function DeltaIndicator({
  delta,
  direction,
}: {
  delta: string | null;
  direction: 'up' | 'down' | 'stable' | null;
}) {
  if (delta === null) return <span className="text-muted-foreground">&mdash;</span>;

  const numDelta = parseFloat(delta);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        direction === 'up' && 'text-success',
        direction === 'down' && 'text-destructive',
        direction === 'stable' && 'text-muted-foreground'
      )}
    >
      {direction === 'up' && <ArrowUp className="size-3" aria-hidden="true" />}
      {direction === 'down' && <ArrowDown className="size-3" aria-hidden="true" />}
      {direction === 'stable' && <Minus className="size-3" aria-hidden="true" />}
      {numDelta > 0 ? '+' : ''}
      {delta}%
    </span>
  );
}

const RANK_ACCENTS = ['border-l-amber-500', 'border-l-zinc-400', 'border-l-orange-600'];

const SORT_HEADER_CLASS =
  'cursor-pointer select-none px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground';

function getSortAria(active: boolean, dir: SortDir): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}

export function BenchmarkTable({ brands }: BenchmarkTableProps) {
  const t = useTranslations('benchmarks');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const maxShare = useMemo(
    () => Math.max(...brands.map((b) => parseFloat(b.recommendationShare.current)), 1),
    [brands]
  );

  const sorted = useMemo(() => {
    const list = [...brands];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'rank':
          return (a.rank - b.rank) * dir;
        case 'brand':
          return a.brandName.localeCompare(b.brandName) * dir;
        case 'share':
          return (
            (parseFloat(a.recommendationShare.current) -
              parseFloat(b.recommendationShare.current)) *
            dir
          );
        case 'shareDelta': {
          const da = a.recommendationShare.delta ? parseFloat(a.recommendationShare.delta) : 0;
          const db = b.recommendationShare.delta ? parseFloat(b.recommendationShare.delta) : 0;
          return (da - db) * dir;
        }
        case 'citations':
          return (a.citationCount.current - b.citationCount.current) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [brands, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm" data-testid="benchmark-table">
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sortKey === 'rank', sortDir)}
                onClick={() => handleSort('rank')}
              >
                {t('table.rank')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sortKey === 'brand', sortDir)}
                onClick={() => handleSort('brand')}
              >
                {t('table.brand')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sortKey === 'share', sortDir)}
                onClick={() => handleSort('share')}
              >
                {t('table.share')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sortKey === 'shareDelta', sortDir)}
                onClick={() => handleSort('shareDelta')}
              >
                {t('table.shareDelta')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sortKey === 'citations', sortDir)}
                onClick={() => handleSort('citations')}
              >
                {t('table.citations')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
              >
                {t('table.modelRuns')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((brand) => {
              const share = parseFloat(brand.recommendationShare.current);
              const barWidth = maxShare > 0 ? (share / maxShare) * 100 : 0;
              return (
                <tr
                  key={brand.brandId}
                  className={cn(
                    'border-b border-l-2 last:border-b-0',
                    brand.rank <= 3 ? RANK_ACCENTS[brand.rank - 1] : 'border-l-transparent'
                  )}
                >
                  <td className="px-4 py-3 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{brand.rank}</span>
                      <RankChangeIndicator change={brand.rankChange} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{brand.brandName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right">{brand.recommendationShare.current}%</span>
                      <div className="h-2 w-20 rounded-sm bg-muted">
                        <div
                          className="h-full rounded-sm bg-primary"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <DeltaIndicator
                      delta={brand.recommendationShare.delta}
                      direction={brand.recommendationShare.direction}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {brand.citationCount.current}
                    {brand.citationCount.delta !== null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({brand.citationCount.delta > 0 ? '+' : ''}
                        {brand.citationCount.delta})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{brand.modelRunCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
