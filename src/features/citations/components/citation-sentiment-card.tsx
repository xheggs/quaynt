'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { SentimentLabel } from '../citation.types';
import { SentimentBadge } from './sentiment-badge';

interface CitationSentimentCardProps {
  sentimentLabel: SentimentLabel;
  sentimentScore: string | null;
  sentimentConfidence: string | null;
}

export function CitationSentimentCard({
  sentimentLabel,
  sentimentScore,
  sentimentConfidence,
}: CitationSentimentCardProps) {
  const t = useTranslations('citations');
  const locale = useLocale();

  const numberFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const percentFormatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.sentimentDetails')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <SentimentBadge sentiment={sentimentLabel} />
        </div>

        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.sentimentScore')}</dt>
            <dd className="text-sm text-muted-foreground">
              {sentimentScore
                ? `${numberFormatter.format(Number(sentimentScore))} (${t('detail.sentimentScoreRange')})`
                : t('detail.notAvailable')}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.sentimentConfidence')}</dt>
            <dd className="text-sm text-muted-foreground">
              {sentimentConfidence
                ? percentFormatter.format(Number(sentimentConfidence))
                : t('detail.notAvailable')}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
