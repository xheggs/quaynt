export interface RecommendationShareComputeInput {
  workspaceId: string;
  promptSetId: string;
  date: string; // ISO date string YYYY-MM-DD
}

export interface RecommendationShareFilters {
  promptSetId: string;
  brandId?: string;
  platformId?: string;
  locale?: string;
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
}

export interface RecommendationShareRow {
  id: string;
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  sharePercentage: string;
  citationCount: number;
  totalCitations: number;
  modelRunCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationShareComputeJobData {
  workspaceId: string;
  promptSetId: string;
  date: string;
}
