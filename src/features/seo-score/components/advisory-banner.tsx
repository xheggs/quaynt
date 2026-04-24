'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { DataQualityAdvisory } from '../seo-score.types';

interface AdvisoryBannerProps {
  advisories: DataQualityAdvisory[];
}

/**
 * Non-dismissible banner that renders when the SEO score covers a period
 * overlapping a GSC data-quality advisory window. Designed to be
 * under-the-ring so operators can't miss it.
 */
export function AdvisoryBanner({ advisories }: AdvisoryBannerProps) {
  const t = useTranslations('seoScore');
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
        {advisories.map((id) => (
          <div key={id}>
            <p className="font-semibold">
              {t(`advisory.${id}.title` as 'advisory.GSC_IMPRESSION_BUG_2025_2026.title')}
            </p>
            <p className="opacity-90">
              {t(`advisory.${id}.body` as 'advisory.GSC_IMPRESSION_BUG_2025_2026.body')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
