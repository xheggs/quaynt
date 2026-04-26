'use client';

import { useTranslations } from 'next-intl';
import { SentimentBadge } from '@/features/citations/components/sentiment-badge';
import { safeSourceLink } from '@/lib/url/safe-source-link';
import { cn } from '@/lib/utils';
import type { CitationRecord } from '@/features/citations/citation.types';

interface Props {
  citation: CitationRecord;
  className?: string;
}

export function CitationStreamItem({ citation, className }: Props) {
  const t = useTranslations('onboarding.firstRun.citations');
  const link = safeSourceLink(citation.sourceUrl);

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border p-3',
        'animate-in fade-in slide-in-from-bottom-1 duration-200',
        'motion-reduce:animate-none',
        className
      )}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{citation.platformId}</span>
        <SentimentBadge sentiment={citation.sentimentLabel} />
        <span>{t('position', { position: citation.position })}</span>
        <span aria-label={t('typeLabel')}>{t(`type.${citation.citationType}`)}</span>
      </header>
      {citation.contextSnippet ? (
        <p className="line-clamp-2 text-sm text-foreground">{citation.contextSnippet}</p>
      ) : null}
      {link.href ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {link.label}
        </a>
      ) : link.label ? (
        <span className="self-start text-xs text-muted-foreground">{link.label}</span>
      ) : null}
    </article>
  );
}
