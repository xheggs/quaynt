export interface CitationSourceFilters {
  promptSetId: string;
  brandId?: string;
  platformId?: string;
  locale?: string;
  domain?: string;
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
}

export interface CitationSourceComputeInput {
  workspaceId: string;
  promptSetId: string;
  date: string;
}

export interface CitationSourceAggregateRow {
  id: string;
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  platformId: string;
  locale: string;
  domain: string;
  periodStart: string;
  frequency: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
