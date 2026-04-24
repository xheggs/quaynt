'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScoreRing } from '@/features/scoring';
import { queryKeys } from '@/lib/query/keys';
import { fetchBrands } from '@/features/brands';
import { useDualScoreQuery } from '../use-dual-score';

interface DualKpiCardProps {
  /**
   * Optional explicit brand. When omitted, the card falls back to the
   * workspace's first brand — matching the existing single-score KPIs.
   */
  brandId?: string;
  className?: string;
}

/**
 * Dashboard KPI that replaces the separate GEO and SEO cards when both
 * scores are available. Downgrades gracefully to whichever score exists;
 * hides itself only when neither is available.
 */
export function DualKpiCard({ brandId, className }: DualKpiCardProps) {
  const t = useTranslations('dualScore');
  const tSeo = useTranslations('seoScore');
  const tGeo = useTranslations('geoScore');

  const brandsQuery = useQuery({
    queryKey: queryKeys.brands.list({ limit: 1 }),
    queryFn: () => fetchBrands({ page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
    enabled: !brandId,
  });

  const resolvedBrandId = brandId ?? brandsQuery.data?.data[0]?.id;
  const { data, isLoading } = useDualScoreQuery({
    brandId: resolvedBrandId ?? '',
  });

  if (!resolvedBrandId || isLoading) return null;
  if (!data || (!data.seo && !data.geo)) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold">
          <Link href="/dual-score" className="hover:underline">
            {t('page.title')}
          </Link>
        </h3>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-1">
          <span className="type-overline text-muted-foreground text-xs">{t('rings.seoLabel')}</span>
          <ScoreRing
            value={data.seo?.composite ?? null}
            delta={data.seo?.delta ?? null}
            outOfLabel={tSeo('headline.out_of')}
            ariaLabel={`${tSeo('headline.label')} ${Math.round(data.seo?.composite ?? 0)}`}
            size={96}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="type-overline text-muted-foreground text-xs">{t('rings.geoLabel')}</span>
          <ScoreRing
            value={data.geo?.composite ?? null}
            delta={data.geo?.delta ?? null}
            capped={!!data.geo?.displayCapApplied}
            outOfLabel={tGeo('headline.out_of')}
            ariaLabel={`${tGeo('headline.label')} ${Math.round(data.geo?.composite ?? 0)}`}
            capLabel={tGeo('headline.cap.label')}
            capTooltip={tGeo('headline.cap.tooltip')}
            size={96}
          />
        </div>
        {data.correlation.label !== 'insufficientData' && (
          <div className="sm:col-span-2 text-center text-xs">
            <span className="text-muted-foreground">
              {t('correlation.rhoLabel', {
                rho: data.correlation.rho?.toFixed(2) ?? '—',
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
