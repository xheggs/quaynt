'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { Opportunity } from '../opportunity.types';

interface OpportunityDetailProps {
  opportunity: Opportunity;
  onCollapse: () => void;
}

export function OpportunityDetail({ opportunity, onCollapse }: OpportunityDetailProps) {
  const t = useTranslations('opportunities');
  const regionRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCollapse();
      }
    },
    [onCollapse]
  );

  // Focus the region when it appears
  useEffect(() => {
    regionRef.current?.focus();
  }, []);

  const sortedCompetitors = useMemo(
    () => [...opportunity.competitors].sort((a, b) => b.citationCount - a.citationCount),
    [opportunity.competitors]
  );

  const maxCitations = useMemo(
    () => Math.max(...sortedCompetitors.map((c) => c.citationCount), 1),
    [sortedCompetitors]
  );

  const actionKey = opportunity.type === 'missing' ? 'actionMissing' : 'actionWeak';

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Region captures Escape key to close expanded detail
    <div
      ref={regionRef}
      role="region"
      aria-label={t('detail.competitorsTitle')}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="space-y-4 px-4 py-4 focus:outline-none"
    >
      {/* Full prompt text */}
      {opportunity.promptText && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t('detail.fullPrompt')}</p>
          <p className="mt-1 text-sm">{opportunity.promptText}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Competitor breakdown */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('detail.competitorsTitle')}
          </p>
          <div className="space-y-2">
            {sortedCompetitors.map((competitor) => {
              const barWidth =
                maxCitations > 0 ? (competitor.citationCount / maxCitations) * 100 : 0;
              return (
                <div key={competitor.brandId} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm">{competitor.brandName}</span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-2 flex-1 rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                      {t('detail.competitorCitations', { count: competitor.citationCount })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Platform breakdown */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('detail.platformsTitle')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {opportunity.platformBreakdown.map((platform) => (
              <div
                key={platform.platformId}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  platform.brandGapOnPlatform
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-success/30 bg-success/5'
                )}
              >
                <span className="text-sm">{platform.platformId}</span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    platform.brandGapOnPlatform ? 'text-destructive' : 'text-success'
                  )}
                >
                  {platform.brandGapOnPlatform
                    ? t('detail.platformGap')
                    : t('detail.platformPresent')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested action */}
      <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t('detail.suggestedAction')}</p>
          <p className="text-sm">{t(`detail.${actionKey}`)}</p>
        </div>
      </div>
    </div>
  );
}
