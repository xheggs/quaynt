'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CitationRecord } from '../citation.types';

interface CitationMetadataCardProps {
  citation: CitationRecord;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function CitationMetadataCard({ citation }: CitationMetadataCardProps) {
  const t = useTranslations('citations');
  const locale = useLocale();

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.metadata')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.sourceUrl')}</dt>
            <dd>
              <a
                href={citation.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline break-all"
              >
                {citation.sourceUrl}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.domain')}</dt>
            <dd className="text-sm text-muted-foreground">{extractDomain(citation.sourceUrl)}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.platform')}</dt>
            <dd className="text-sm text-muted-foreground">
              {(() => {
                const pid = citation.platformId;
                const knownPlatforms = [
                  'chatgpt',
                  'perplexity',
                  'gemini',
                  'claude',
                  'copilot',
                  'grok',
                  'deepseek',
                  'aio',
                ];
                return knownPlatforms.includes(pid)
                  ? t(`platforms.${pid}` as Parameters<typeof t>[0])
                  : pid;
              })()}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.position')}</dt>
            <dd className="text-sm text-muted-foreground">#{citation.position}</dd>
          </div>

          {citation.locale && (
            <div className="space-y-1">
              <dt className="text-sm font-medium">{t('detail.locale')}</dt>
              <dd className="text-sm text-muted-foreground">{citation.locale}</dd>
            </div>
          )}

          <div className="space-y-1">
            <dt className="text-sm font-medium">{t('detail.created')}</dt>
            <dd className="text-sm text-muted-foreground">
              {dateFormatter.format(new Date(citation.createdAt))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
