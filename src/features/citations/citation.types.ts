/**
 * Client-side citation types mirroring the API response shape.
 * See: modules/citations/citation.schema.ts (database schema)
 * See: app/api/v1/citations/route.ts (API response)
 */

export type CitationType = 'owned' | 'earned';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type RelevanceSignal = 'domain_match' | 'title_match' | 'snippet_match' | 'response_mention';

export interface CitationRecord {
  id: string;
  workspaceId: string;
  brandId: string;
  modelRunId: string;
  modelRunResultId: string;
  platformId: string;
  citationType: CitationType;
  position: number;
  contextSnippet: string | null;
  relevanceSignal: RelevanceSignal;
  sourceUrl: string;
  title: string | null;
  locale: string | null;
  sentimentLabel: SentimentLabel | null;
  sentimentScore: string | null;
  sentimentConfidence: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitationListFilters {
  brandId?: string;
  platformId?: string;
  citationType?: CitationType;
  sentiment?: SentimentLabel;
  locale?: string;
  from?: string;
  to?: string;
  search?: string;
}
