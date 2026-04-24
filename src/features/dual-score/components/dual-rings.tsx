'use client';

import { useTranslations } from 'next-intl';
import { ScoreRing } from '@/features/scoring';
import type { DualScoreResponse, Granularity } from '../dual-score.types';

interface DualRingsProps {
  dual: DualScoreResponse | undefined;
  granularity: Granularity;
}

export function DualRings({ dual, granularity }: DualRingsProps) {
  const t = useTranslations('dualScore');
  const tSeo = useTranslations('seoScore');
  const tGeo = useTranslations('geoScore');

  const seoComposite = dual?.seo?.composite ?? null;
  const geoComposite = dual?.geo?.composite ?? null;
  const deltaLabel =
    granularity === 'weekly' ? t('rings.deltaLabel.weekly') : t('rings.deltaLabel.monthly');

  const seoAria =
    seoComposite !== null
      ? `${tSeo('headline.label')} ${Math.round(seoComposite)} ${tSeo('headline.out_of')}`
      : tSeo('headline.label');
  const geoAria =
    geoComposite !== null
      ? `${tGeo('headline.label')} ${Math.round(geoComposite)} ${tGeo('headline.out_of')}`
      : tGeo('headline.label');

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col items-center gap-2">
        <h3 className="type-overline text-muted-foreground text-xs uppercase">
          {t('rings.seoLabel')}
        </h3>
        <ScoreRing
          value={seoComposite}
          delta={dual?.seo?.delta ?? null}
          outOfLabel={tSeo('headline.out_of')}
          ariaLabel={seoAria}
        />
        <p className="text-muted-foreground text-xs">{deltaLabel}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h3 className="type-overline text-muted-foreground text-xs uppercase">
          {t('rings.geoLabel')}
        </h3>
        <ScoreRing
          value={geoComposite}
          delta={dual?.geo?.delta ?? null}
          capped={!!dual?.geo?.displayCapApplied}
          outOfLabel={tGeo('headline.out_of')}
          ariaLabel={geoAria}
          capLabel={tGeo('headline.cap.label')}
          capTooltip={tGeo('headline.cap.tooltip')}
        />
        <p className="text-muted-foreground text-xs">{deltaLabel}</p>
      </div>
    </div>
  );
}
