'use client';

import { useTranslations } from 'next-intl';
import { FactorGrid, type ScoringFactorView } from '@/features/scoring';
import type { DualScoreResponse } from '../dual-score.types';
import type { FactorId, FactorResult, FactorStatus } from '@/features/geo-score/geo-score.types';
import type {
  SeoFactorId,
  SeoFactorResult,
  SeoFactorStatus,
} from '@/features/seo-score/seo-score.types';

interface FactorComparisonStripProps {
  dual: DualScoreResponse | undefined;
}

type GeoT = ReturnType<typeof useTranslations<'geoScore'>>;
type SeoT = ReturnType<typeof useTranslations<'seoScore'>>;

function geoFactorView(factor: FactorResult, t: GeoT): ScoringFactorView {
  const id = factor.id as FactorId;
  const status = factor.status as FactorStatus;
  const hintKey =
    status === 'notYetScored'
      ? 'factor.notYetScoredHint'
      : status === 'insufficientData'
        ? 'factor.insufficientDataHint'
        : null;
  return {
    id,
    score: factor.score,
    weight: factor.weight,
    status,
    name: t(`factor.${id}.name` as 'factor.citation_frequency.name'),
    description: t(`factor.${id}.description` as 'factor.citation_frequency.description'),
    weightLabel: t('factor.weight', { weight: factor.weight }),
    statusLabel: t(`factor.status.${status}` as 'factor.status.active'),
    hint: hintKey ? t(hintKey) : null,
  };
}

function seoFactorView(factor: SeoFactorResult, t: SeoT): ScoringFactorView {
  const id = factor.id as SeoFactorId;
  const status = factor.status as SeoFactorStatus;
  return {
    id,
    score: factor.score,
    weight: factor.weight,
    status,
    name: t(`factor.${id}.name` as 'factor.impression_volume.name'),
    description: t(`factor.${id}.description` as 'factor.impression_volume.description'),
    weightLabel: t('factor.weight', { weight: factor.weight }),
    statusLabel: t(`factor.status.${status}` as 'factor.status.active'),
    hint: status === 'insufficientData' ? t('factor.insufficientDataHint') : null,
  };
}

export function FactorComparisonStrip({ dual }: FactorComparisonStripProps) {
  const t = useTranslations('dualScore');
  const tGeo = useTranslations('geoScore');
  const tSeo = useTranslations('seoScore');

  const seoFactors: ScoringFactorView[] =
    dual?.seo?.factors.map((f) => seoFactorView(f, tSeo)) ?? [];
  const geoFactors: ScoringFactorView[] =
    dual?.geo?.factors.map((f) => geoFactorView(f, tGeo)) ?? [];

  if (!dual?.seo && !dual?.geo) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t('factors.title')}</h2>
      <p className="text-muted-foreground text-xs">{t('factors.mapping.hint')}</p>
      {seoFactors.length > 0 && (
        <div>
          <h3 className="type-overline text-muted-foreground mb-2 text-xs uppercase">
            {t('factors.seoHeader')}
          </h3>
          <FactorGrid factors={seoFactors} columns={4} />
        </div>
      )}
      {geoFactors.length > 0 && (
        <div>
          <h3 className="type-overline text-muted-foreground mb-2 text-xs uppercase">
            {t('factors.geoHeader')}
          </h3>
          <FactorGrid factors={geoFactors} columns={3} />
        </div>
      )}
    </section>
  );
}
