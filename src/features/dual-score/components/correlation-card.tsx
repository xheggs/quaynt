'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { DualCorrelationStat, Granularity } from '../dual-score.types';

interface CorrelationCardProps {
  correlation: DualCorrelationStat | undefined;
  granularity: Granularity;
}

function formatRho(rho: number | null): string {
  if (rho === null) return '—';
  return rho.toFixed(2);
}

export function CorrelationCard({ correlation, granularity }: CorrelationCardProps) {
  const t = useTranslations('dualScore');
  if (!correlation) return null;
  const { rho, label, direction, n } = correlation;

  const isInsufficient = label === 'insufficientData';
  const isEarly = label === 'earlyReading';

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-base font-semibold">{t('correlation.title')}</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isInsufficient ? (
          <>
            <p className="text-muted-foreground">{t('correlation.label.insufficientData')}</p>
            <p className="text-muted-foreground text-xs">
              {t('correlation.insufficientDataHint', { granularity })}
            </p>
          </>
        ) : (
          <>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {t('correlation.rhoLabel', { rho: formatRho(rho) })}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('correlation.sampleSize', { n, granularity })}
            </p>
            {isEarly ? (
              <>
                <p className="text-amber-700 dark:text-amber-400 font-medium">
                  {t('correlation.label.earlyReading')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('correlation.earlyReadingHint', { n, granularity })}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  {t(`correlation.label.${label}` as 'correlation.label.strong')}
                </p>
                {direction && (
                  <p className="text-muted-foreground text-xs">
                    {t(`correlation.direction.${direction}` as 'correlation.direction.positive')}
                  </p>
                )}
              </>
            )}
          </>
        )}
        <p className="text-muted-foreground text-xs italic">{t('correlation.caveat')}</p>
      </CardContent>
    </Card>
  );
}
