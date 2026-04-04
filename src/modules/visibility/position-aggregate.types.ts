export interface PositionAggregateComputeInput {
  workspaceId: string;
  promptSetId: string;
  date: string; // ISO date string YYYY-MM-DD
}

export interface PositionAggregateFilters {
  promptSetId: string;
  brandId?: string;
  platformId?: string;
  locale?: string;
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
}

export interface PositionAggregateRow {
  id: string;
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  citationCount: number;
  averagePosition: string;
  medianPosition: string;
  minPosition: number;
  maxPosition: number;
  firstMentionCount: number;
  firstMentionRate: string;
  topThreeCount: number;
  topThreeRate: string;
  positionDistribution: Record<string, number>;
  modelRunCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionSummary {
  totalCitations: number;
  overallAveragePosition: string;
  overallFirstMentionRate: string;
  overallTopThreeRate: string;
  brandsTracked: number;
}
