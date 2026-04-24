'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeoScoreRecommendation } from '../geo-score.types';

interface RecommendationsListProps {
  recommendations: GeoScoreRecommendation[];
}

const severityClass = {
  high: 'border-destructive text-destructive',
  medium: 'border-amber-500 text-amber-700 dark:text-amber-400',
  low: 'border-muted-foreground text-muted-foreground',
} as const;

export function RecommendationsList({ recommendations }: RecommendationsListProps) {
  const t = useTranslations('geoScore');

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t('recommendations.empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((rec, idx) => (
        <li key={`${rec.factorId}-${idx}`}>
          <Card>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {t(rec.titleKey as 'recommendations.empty')}
                </h3>
                <Badge
                  variant="outline"
                  className={cn('shrink-0 text-xs', severityClass[rec.severity])}
                  title={t(`recommendations.severity.${rec.severity}`)}
                >
                  {t(`recommendations.severity.${rec.severity}`)}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {t(rec.descriptionKey as 'recommendations.empty')}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {t(`factor.${rec.factorId}.name` as 'factor.citation_frequency.name')}
                </Badge>
                <span
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
                  title={t('recommendations.estDeltaTooltip')}
                >
                  {t('recommendations.estDelta', { delta: rec.estimatedPointDelta })}
                </span>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
