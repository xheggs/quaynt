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
