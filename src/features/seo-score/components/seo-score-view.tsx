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
  useSeoScoreHistoryQuery,
  useSeoScoreQuery,
  useSeoScoreRecommendationsQuery,
} from '../use-seo-score';
import type { Granularity, SeoFactorId, SeoFactorResult, SeoScoreCode } from '../seo-score.types';
import { FactorGrid, ScoreRing, type ScoringFactorView } from '@/features/scoring';
import { ScoreTrendChart } from './score-trend-chart';
import { RecommendationsList } from './recommendations-list';
import { AdvisoryBanner } from './advisory-banner';
import { SeoScoreSkeleton } from './seo-score-skeleton';

interface SeoScoreViewProps {
  brandId?: string;
  defaultGranularity?: Granularity;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

type SeoFactorTranslator = ReturnType<typeof useTranslations<'seoScore'>>;

function toFactorView(factor: SeoFactorResult, t: SeoFactorTranslator): ScoringFactorView {
  const id = factor.id as SeoFactorId;
  const hint = factor.status === 'insufficientData' ? t('factor.insufficientDataHint') : null;
  return {
    id,
    score: factor.score,
    weight: factor.weight,
    status: factor.status,
    name: t(`factor.${id}.name` as 'factor.impression_volume.name'),
    description: t(`factor.${id}.description` as 'factor.impression_volume.description'),
    weightLabel: t('factor.weight', { weight: factor.weight }),
    statusLabel: t(`factor.status.${factor.status}` as 'factor.status.active'),
    hint,
  };
}

export function SeoScoreView({ brandId, defaultGranularity = 'monthly' }: SeoScoreViewProps) {
  const t = useTranslations('seoScore');
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);

  const scoreQuery = useSeoScoreQuery({
    brandId: brandId ?? '',
    granularity,
  });
  const historyQuery = useSeoScoreHistoryQuery({
    brandId: brandId ?? '',
    granularity,
    from: monthsAgoIso(granularity === 'weekly' ? 3 : 12),
    to: new Date().toISOString().slice(0, 10),
  });
  const recsQuery = useSeoScoreRecommendationsQuery({
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

  if (scoreQuery.isLoading) return <SeoScoreSkeleton />;

  const score = scoreQuery.data;
  const history = historyQuery.data;
  const recs = recsQuery.data?.recommendations ?? [];
  const code = (score?.code ?? null) as SeoScoreCode | null;

  const composite = score?.composite ?? null;
  const ariaLabel =
    composite !== null
      ? `${t('headline.label')} ${Math.round(composite)} ${t('headline.out_of')}`
      : t('headline.label');
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

      {score && score.dataQualityAdvisories.length > 0 && (
        <AdvisoryBanner advisories={score.dataQualityAdvisories} />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center">
            <ScoreRing
              value={composite}
              delta={history?.trend.delta ?? null}
              outOfLabel={t('headline.out_of')}
              ariaLabel={ariaLabel}
            />
          </div>
        </CardHeader>
        <CardContent>
          {code && (
            <div className="text-muted-foreground space-y-1 text-center text-sm">
              <p className="font-medium">
                {t(`empty.${code}.title` as 'empty.NO_GSC_CONNECTION.title')}
              </p>
              <p>{t(`empty.${code}.description` as 'empty.NO_GSC_CONNECTION.description')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {score && <FactorGrid factors={factorViews} columns={4} />}

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
