export type OpportunityType = 'missing' | 'weak';

export interface OpportunityComputeInput {
  workspaceId: string;
  promptSetId: string;
  date: string; // ISO date string YYYY-MM-DD
}

export interface OpportunityComputeJobData {
  workspaceId: string;
  promptSetId: string;
  date: string;
}

export interface OpportunityFilters {
  promptSetId: string;
  brandId: string;
  type?: OpportunityType;
  minCompetitorCount?: number;
  platformId?: string;
  from?: string;
  to?: string;
}

export interface OpportunityCompetitor {
  brandId: string;
  brandName: string;
  citationCount: number;
}

export interface OpportunityPlatformBreakdown {
  platformId: string;
  brandGapOnPlatform: boolean;
  competitorCount: number;
}

export interface OpportunityRow {
  id: string;
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  promptId: string;
  promptText: string | null;
  periodStart: string;
  type: OpportunityType;
  score: string;
  competitorCount: number;
  totalTrackedBrands: number;
  platformCount: number;
  brandCitationCount: number;
  competitors: OpportunityCompetitor[];
  platformBreakdown: OpportunityPlatformBreakdown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OpportunitySummary {
  totalOpportunities: number;
  missingCount: number;
  weakCount: number;
  averageScore: string;
}
