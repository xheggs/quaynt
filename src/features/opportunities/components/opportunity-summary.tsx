'use client';

import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { OpportunitySummary as OpportunitySummaryType } from '../opportunity.types';

interface OpportunitySummaryProps {
  summary: OpportunitySummaryType;
}

function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

const scoreLevelStyles = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
} as const;

export function OpportunitySummary({ summary }: OpportunitySummaryProps) {
  const t = useTranslations('opportunities');

  const avgScore = parseFloat(summary.averageScore);
  const scoreLevel = getScoreLevel(avgScore);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        className="p-5"
        aria-label={`${t('summary.totalOpportunities')}: ${summary.totalOpportunities}`}
      >
        <CardContent className="space-y-1 p-0">
          <p className="type-overline text-muted-foreground">{t('summary.totalOpportunities')}</p>
          <p className="type-kpi text-foreground">{summary.totalOpportunities}</p>
          <p className="text-xs text-muted-foreground">
            {t('summary.totalCount', { count: summary.totalOpportunities })}
          </p>
        </CardContent>
      </Card>

      <Card className="p-5" aria-label={`${t('summary.missing')}: ${summary.missingCount}`}>
        <CardContent className="space-y-1 p-0">
          <p className="type-overline text-muted-foreground">{t('summary.missing')}</p>
          <p className="type-kpi text-amber-600 dark:text-amber-400">{summary.missingCount}</p>
          <p className="text-xs text-muted-foreground">{t('summary.missingSubtext')}</p>
        </CardContent>
      </Card>

      <Card className="p-5" aria-label={`${t('summary.weak')}: ${summary.weakCount}`}>
        <CardContent className="space-y-1 p-0">
          <p className="type-overline text-muted-foreground">{t('summary.weak')}</p>
          <p className="type-kpi text-muted-foreground">{summary.weakCount}</p>
          <p className="text-xs text-muted-foreground">{t('summary.weakSubtext')}</p>
        </CardContent>
      </Card>

      <Card className="p-5" aria-label={t('score.ariaLabel', { score: summary.averageScore })}>
        <CardContent className="space-y-1 p-0">
          <div className="flex items-center gap-1">
            <p className="type-overline text-muted-foreground">{t('summary.averageScore')}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <HelpCircle className="size-4" aria-hidden="true" />
                  <span className="sr-only">{t('score.tooltip')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{t('score.tooltip')}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="type-kpi text-foreground">{summary.averageScore}</p>
            <span className="text-sm text-muted-foreground">/80</span>
          </div>
          <span
            className={cn(
              'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
              scoreLevelStyles[scoreLevel]
            )}
          >
            {t(`score.${scoreLevel}`)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

export { getScoreLevel, scoreLevelStyles };
