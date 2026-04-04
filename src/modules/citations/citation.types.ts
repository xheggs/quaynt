export type { Citation } from '@/modules/adapters/adapter.types';

export type RelevanceSignal = 'domain_match' | 'title_match' | 'snippet_match' | 'response_mention';

export interface CitationFilters {
  brandId?: string;
  platformId?: string;
  citationType?: 'owned' | 'earned';
  modelRunId?: string;
  locale?: string;
  sentimentLabel?: 'positive' | 'neutral' | 'negative';
  from?: string;
  to?: string;
}

export interface CitationExtractJobData {
  runId: string;
  workspaceId: string;
}
