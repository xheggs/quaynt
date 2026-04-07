export interface SentimentAggregateFilters {
  brandId?: string;
  promptSetId: string;
  platformId?: string;
  locale?: string;
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
}

export interface SentimentAggregateComputeInput {
  workspaceId: string;
  promptSetId: string;
  date: string;
}

export interface SentimentAggregateRow {
  id: string;
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
  positivePercentage: string;
  neutralPercentage: string;
  negativePercentage: string;
  netSentimentScore: string;
  averageScore: string | null;
  modelRunCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Aggregated sentiment data returned for week/month granularity (no row-level id/timestamps). */
export interface SentimentAggregatedResult {
  periodStart: string;
  brandId: string;
  promptSetId: string;
  platformId: string;
  locale: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
  positivePercentage: string;
  neutralPercentage: string;
  negativePercentage: string;
  netSentimentScore: string;
  averageScore: string | null;
  modelRunCount: number;
}
