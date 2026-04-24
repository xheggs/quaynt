'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { DataQualityAdvisory } from '@/features/seo-score/seo-score.types';

interface DualAdvisoryBannerProps {
  advisories: DataQualityAdvisory[];
}

/**
 * Renders the union of SEO-side data-quality advisories aggregated by the
 * dual-score service. v1 sources advisories from SEO snapshots only; GEO
 * advisories are a forward-looking extension.
 */
export function DualAdvisoryBanner({ advisories }: DualAdvisoryBannerProps) {
  const t = useTranslations('dualScore');
  const tSeo = useTranslations('seoScore');
  if (advisories.length === 0) return null;

  return (
    <div
      role="alert"
      className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3 rounded-md border px-4 py-3 text-sm"
    >
      <AlertTriangle
        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="space-y-2">
        <p className="font-semibold">{t('advisory.title')}</p>
        {advisories.map((id) => (
          <div key={id}>
            <p className="font-semibold">
              {tSeo(`advisory.${id}.title` as 'advisory.GSC_IMPRESSION_BUG_2025_2026.title')}
            </p>
            <p className="opacity-90">
              {tSeo(`advisory.${id}.body` as 'advisory.GSC_IMPRESSION_BUG_2025_2026.body')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
