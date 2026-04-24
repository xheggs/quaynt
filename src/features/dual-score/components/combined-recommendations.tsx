'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DualCombinedRecommendationsResponse } from '../dual-score.types';

interface CombinedRecommendationsProps {
  data: DualCombinedRecommendationsResponse | undefined;
  isLoading: boolean;
}

export function CombinedRecommendations({ data, isLoading }: CombinedRecommendationsProps) {
  const t = useTranslations('dualScore');
  const tGeo = useTranslations('geoScore');
  const tSeo = useTranslations('seoScore');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">…</CardContent>
      </Card>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t('recommendations.empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{t('recommendations.title')}</h2>
        <p className="text-muted-foreground text-xs">{t('recommendations.description')}</p>
      </div>
      {data.partial && (
        <p
          role="status"
          className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-md border px-3 py-2 text-xs"
        >
          {t('recommendations.partialFailure')}
        </p>
      )}
      <ul className="space-y-2">
        {data.recommendations.map((r, idx) => {
          const sourceLabel = t(
            `recommendations.source.${r.source}` as 'recommendations.source.seo'
          );
          const key = `${r.source}-${r.factorId}-${idx}`;
          const title =
            r.source === 'seo'
              ? tSeo(r.titleKey as 'recommendations.impression_volume.title')
              : tGeo(r.titleKey as 'recommendations.citation_frequency.title');
          const description =
            r.source === 'seo'
              ? tSeo(r.descriptionKey as 'recommendations.impression_volume.description')
              : tGeo(r.descriptionKey as 'recommendations.citation_frequency.description');
          return (
            <li key={key}>
              <Card>
                <CardContent className="flex items-start gap-3 p-4">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {sourceLabel}
                  </Badge>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-muted-foreground text-xs">{description}</p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="rounded-full border px-2 py-0.5 tabular-nums">
                      +{r.estimatedPointDelta.toFixed(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
