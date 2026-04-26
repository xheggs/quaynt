'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SentimentBadge } from '@/features/citations/components/sentiment-badge';
import { safeSourceLink } from '@/lib/url/safe-source-link';
import { cn } from '@/lib/utils';
import type { CitationRecord } from '@/features/citations/citation.types';

interface Props {
  citation: CitationRecord;
  onDismiss: () => void;
  viewAllHref: string;
  className?: string;
}

export function WowCard({ citation, onDismiss, viewAllHref, className }: Props) {
  const t = useTranslations('onboarding.wow');
  const [expanded, setExpanded] = useState(false);

  const link = safeSourceLink(citation.sourceUrl);
  const snippet = citation.contextSnippet ?? '';
  const isLongSnippet = snippet.length > 240;

  return (
    <Card
      role="status"
      aria-live="polite"
      // CSS-only entrance: subtle fade + translate-y. motion-reduce disables
      // the transform so vestibular-sensitive users see no movement.
      className={cn(
        'relative animate-in fade-in slide-in-from-top-2 duration-200',
        'motion-reduce:animate-none motion-reduce:fade-in-0',
        'border-primary/40 ring-1 ring-primary/20',
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg">
              {t('title', { platform: citation.platformId })}
            </h2>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label={t('dismiss')}
          className="-mr-2 -mt-2"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <blockquote
          className={cn(
            'text-sm italic text-foreground',
            !expanded && isLongSnippet && 'line-clamp-3'
          )}
        >
          {snippet || t('noSnippet')}
        </blockquote>
        {isLongSnippet ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            {expanded ? t('collapse') : t('expand')}
          </button>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <SentimentBadge sentiment={citation.sentimentLabel} />
          <span>{t('position', { position: citation.position })}</span>
          {link.href ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              {link.label}
            </a>
          ) : link.label ? (
            <span aria-label={t('unsafeSourceLabel')}>{link.label}</span>
          ) : null}
        </div>
        <div>
          <Button asChild size="sm">
            <Link href={viewAllHref} onClick={onDismiss}>
              {t('cta')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
