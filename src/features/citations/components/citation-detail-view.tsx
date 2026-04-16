'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { queryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/query/types';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { DetailSkeleton } from '@/components/skeletons/detail-skeleton';

import { fetchCitation } from '../citation.api';
import { CitationTypeBadge } from './citation-type-badge';
import { SentimentBadge } from './sentiment-badge';
import { CitationMetadataCard } from './citation-metadata-card';
import { CitationSnippetCard } from './citation-snippet-card';
import { CitationSentimentCard } from './citation-sentiment-card';

interface CitationDetailViewProps {
  citationId: string;
}

export function CitationDetailView({ citationId }: CitationDetailViewProps) {
  return (
    <ErrorBoundary>
      <CitationDetailContent citationId={citationId} />
    </ErrorBoundary>
  );
}

function CitationDetailContent({ citationId }: CitationDetailViewProps) {
  const t = useTranslations('citations');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('search') ?? undefined;

  const {
    data: citation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.citations.detail(citationId),
    queryFn: () => fetchCitation(citationId),
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  // 404 handling
  if (isError && error instanceof ApiError && error.status === 404) {
    return (
      <ErrorState
        variant="page"
        title={t('errors.notFound')}
        description={tUi('error.notFound.description')}
      />
    );
  }

  if (isError) {
    return <ErrorState variant="section" onRetry={() => refetch()} />;
  }

  if (showSkeleton || !citation) {
    return <DetailSkeleton />;
  }

  const displayTitle = citation.title || t('detail.positionLabel', { position: citation.position });

  const relevanceKeyMap = {
    domain_match: 'domainMatch',
    title_match: 'titleMatch',
    snippet_match: 'snippetMatch',
    response_mention: 'responseMention',
  } as const;
  const relevanceKey = relevanceKeyMap[citation.relevanceSignal];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label={tUi('breadcrumb.label')}>
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href={`/${locale}/citations`} className="hover:text-foreground transition-colors">
              {t('labels.citations')}
            </Link>
          </li>
          <li>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="text-foreground font-medium line-clamp-1">
            {displayTitle}
          </li>
        </ol>
      </nav>

      {/* Back button + Header */}
      <div className="space-y-3">
        <Link href={`/${locale}/citations`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            {t('detail.backToList')}
          </Button>
        </Link>
        <div>
          <h1 className="type-page">{displayTitle}</h1>
          <div className="mt-2 flex items-center gap-2">
            <CitationTypeBadge type={citation.citationType} />
            <SentimentBadge sentiment={citation.sentimentLabel} />
          </div>
        </div>
      </div>

      {/* Content cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <CitationMetadataCard citation={citation} />

          {/* Relevance signal */}
          <div className="rounded-lg border border-border p-4 space-y-1">
            <h2 className="text-sm font-medium">{t('detail.relevanceSignal')}</h2>
            <p className="text-sm font-medium text-foreground">
              {t(`relevanceSignal.${relevanceKey}` as Parameters<typeof t>[0])}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`relevanceSignal.${relevanceKey}Description` as Parameters<typeof t>[0])}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {citation.contextSnippet && (
            <CitationSnippetCard snippet={citation.contextSnippet} searchTerm={searchTerm} />
          )}

          {citation.sentimentLabel && (
            <CitationSentimentCard
              sentimentLabel={citation.sentimentLabel}
              sentimentScore={citation.sentimentScore}
              sentimentConfidence={citation.sentimentConfidence}
            />
          )}
        </div>
      </div>
    </div>
  );
}
