'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BrandBenchmark } from '../benchmark.types';

interface PlatformBreakdownProps {
  brands: BrandBenchmark[];
}

function getIntensityClass(share: number): string {
  if (share <= 0) return '';
  if (share < 10) return 'bg-primary/5';
  if (share < 25) return 'bg-primary/15';
  return 'bg-primary/30';
}

export function PlatformBreakdown({ brands }: PlatformBreakdownProps) {
  const t = useTranslations('benchmarks');

  const hasBreakdown = brands.some((b) => b.platformBreakdown !== undefined);

  const platformIds = useMemo(() => {
    const ids = new Set<string>();
    for (const brand of brands) {
      if (brand.platformBreakdown) {
        for (const pb of brand.platformBreakdown) {
          ids.add(pb.platformId);
        }
      }
    }
    return Array.from(ids).sort();
  }, [brands]);

  if (!hasBreakdown) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">{t('platforms.noBreakdown')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('platforms.title')}</CardTitle>
        <CardDescription>{t('platforms.description')}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-4">
        <table className="w-full text-sm" data-testid="platform-breakdown">
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-2 text-left font-medium text-muted-foreground">
                {t('table.brand')}
              </th>
              {platformIds.map((id) => (
                <th
                  key={id}
                  scope="col"
                  className="px-3 py-2 text-center font-medium text-muted-foreground"
                >
                  {id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.brandId} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{brand.brandName}</td>
                {platformIds.map((platformId) => {
                  const pb = brand.platformBreakdown?.find((p) => p.platformId === platformId);
                  const share = pb ? parseFloat(pb.sharePercentage) : 0;
                  const delta = pb?.delta;
                  return (
                    <td
                      key={platformId}
                      className={cn('px-3 py-2 text-center tabular-nums', getIntensityClass(share))}
                      title={
                        delta
                          ? `${share}% (${parseFloat(delta) > 0 ? '+' : ''}${delta}%)`
                          : `${share}%`
                      }
                    >
                      {share > 0 ? `${pb!.sharePercentage}%` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
