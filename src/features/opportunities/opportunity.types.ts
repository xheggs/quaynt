/**
 * Client-side opportunity types.
 *
 * These mirror the server-side types from @/modules/visibility/opportunity.types
 * but are duplicated here to avoid importing from server modules, which can
 * pull in server-side dependencies through barrel re-exports and break client
 * component bundling.
 */

import type { PaginatedMeta } from '@/lib/query/types';

// Source: @/modules/visibility/opportunity.types
export type OpportunityType = 'missing' | 'weak';

// Source: @/modules/visibility/opportunity.types
export interface OpportunityFilters {
  promptSetId: string;
  brandId: string;
  type?: OpportunityType;
  minCompetitorCount?: number;
  platformId?: string;
  from?: string;
  to?: string;
}

// Source: @/modules/visibility/opportunity.types
export interface OpportunityCompetitor {
  brandId: string;
  brandName: string;
  citationCount: number;
}

// Source: @/modules/visibility/opportunity.types
export interface OpportunityPlatformBreakdown {
  platformId: string;
  brandGapOnPlatform: boolean;
  competitorCount: number;
}

// Source: @/modules/visibility/opportunity.types
export interface Opportunity {
  id: string;
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
}

// Source: @/modules/visibility/opportunity.types
export interface OpportunitySummary {
  totalOpportunities: number;
  missingCount: number;
  weakCount: number;
  averageScore: string;
}

/**
 * Full API response from GET /api/v1/visibility/opportunities.
 * Extends the standard paginated response with a summary object.
 */
export interface OpportunityResult {
  data: Opportunity[];
  meta: PaginatedMeta;
  summary: OpportunitySummary;
}

export type OpportunitySortField =
  | 'score'
  | 'competitorCount'
  | 'platformCount'
  | 'type'
  | 'periodStart';

/**
 * UI-specific filter type used by the opportunity view.
 * Matches OpportunityFilters — pagination/sort state is managed separately via nuqs.
 */
export type OpportunityViewFilters = OpportunityFilters;
