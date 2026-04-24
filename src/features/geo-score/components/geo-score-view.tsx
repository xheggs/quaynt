'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useGeoScoreHistoryQuery,
  useGeoScoreQuery,
  useGeoScoreRecommendationsQuery,
} from '../use-geo-score';
import type { FactorId, FactorResult, Granularity } from '../geo-score.types';
import { FactorGrid, ScoreRing, type ScoringFactorView } from '@/features/scoring';
import { ScoreTrendChart } from './score-trend-chart';
import { RecommendationsList } from './recommendations-list';
import { GeoScoreSkeleton } from './geo-score-skeleton';

interface GeoScoreViewProps {
  brandId?: string;
  defaultGranularity?: Granularity;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

type GeoFactorTranslator = ReturnType<typeof useTranslations<'geoScore'>>;

function toFactorView(factor: FactorResult, t: GeoFactorTranslator): ScoringFactorView {
  const id = factor.id as FactorId;
  const hintKey =
    factor.status === 'notYetScored'
      ? 'factor.notYetScoredHint'
      : factor.status === 'insufficientData'
        ? 'factor.insufficientDataHint'
        : null;
  return {
    id,
    score: factor.score,
    weight: factor.weight,
    status: factor.status,
    name: t(`factor.${id}.name` as 'factor.citation_frequency.name'),
    description: t(`factor.${id}.description` as 'factor.citation_frequency.description'),
    weightLabel: t('factor.weight', { weight: factor.weight }),
    statusLabel: t(`factor.status.${factor.status}` as 'factor.status.active'),
    hint: hintKey ? t(hintKey) : null,
  };
}

export function GeoScoreView({ brandId, defaultGranularity = 'monthly' }: GeoScoreViewProps) {
  const t = useTranslations('geoScore');
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);

  const scoreQuery = useGeoScoreQuery({ brandId: brandId ?? '', granularity });
  const historyQuery = useGeoScoreHistoryQuery({
    brandId: brandId ?? '',
    granularity,
    from: monthsAgoIso(granularity === 'weekly' ? 3 : 12),
    to: new Date().toISOString().slice(0, 10),
  });
  const recsQuery = useGeoScoreRecommendationsQuery({
    brandId: brandId ?? '',
    granularity,
  });

  if (!brandId) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t('errors.brandRequired')}
        </CardContent>
      </Card>
    );
  }

  if (scoreQuery.isLoading) return <GeoScoreSkeleton />;

  const score = scoreQuery.data;
  const history = historyQuery.data;
  const recs = recsQuery.data?.recommendations ?? [];

  const composite = score?.composite ?? null;
  const ariaLabel =
    composite !== null
      ? `${t('headline.label')} ${Math.round(composite)} ${t('headline.out_of')}`
      : t('errors.insufficientFactors');
  const factorViews: ScoringFactorView[] = score
    ? score.factors.map((f) => toFactorView(f, t))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="type-h1 text-2xl font-semibold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('page.description')}</p>
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">{t('granularity.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('granularity.monthly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center">
            <ScoreRing
              value={composite}
              capped={!!score?.displayCapApplied}
              delta={history?.trend.delta ?? null}
              outOfLabel={t('headline.out_of')}
              ariaLabel={ariaLabel}
              capLabel={t('headline.cap.label')}
              capTooltip={t('headline.cap.tooltip')}
            />
          </div>
        </CardHeader>
        <CardContent>
          {score?.code === 'NO_ENABLED_PROMPT_SETS' && (
            <p className="text-muted-foreground text-center text-sm">{t('empty.description')}</p>
          )}
          {score?.code === 'INSUFFICIENT_FACTORS' && (
            <p className="text-muted-foreground text-center text-sm">
              {t('errors.insufficientFactors')}
            </p>
          )}
        </CardContent>
      </Card>

      {score && <FactorGrid factors={factorViews} columns={3} />}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{t('trend.title')}</h2>
        </CardHeader>
        <CardContent>
          <ScoreTrendChart snapshots={history?.snapshots ?? []} loading={historyQuery.isLoading} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold">{t('recommendations.title')}</h2>
        <RecommendationsList recommendations={recs} />
      </div>
    </div>
  );
}
