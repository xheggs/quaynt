import { eq, and, gte, desc, sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { opportunity } from './opportunity.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import type { OpportunityFilters, OpportunityRow, OpportunitySummary } from './opportunity.types';

const SORT_COLUMNS: Record<string, Column> = {
  score: opportunity.score,
  competitorCount: opportunity.competitorCount,
  platformCount: opportunity.platformCount,
  type: opportunity.type,
  periodStart: opportunity.periodStart,
};

export const OPPORTUNITY_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

export async function getOpportunities(
  workspaceId: string,
  filters: OpportunityFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
): Promise<{ items: OpportunityRow[]; total: number; summary: OpportunitySummary }> {
  const conditions: SQL[] = [
    eq(opportunity.workspaceId, workspaceId),
    eq(opportunity.promptSetId, filters.promptSetId),
    eq(opportunity.brandId, filters.brandId),
  ];

  if (filters.type) {
    conditions.push(eq(opportunity.type, filters.type));
  }

  if (filters.minCompetitorCount) {
    conditions.push(gte(opportunity.competitorCount, filters.minCompetitorCount));
  }

  if (filters.platformId) {
    // JSONB containment: check if platformBreakdown contains an entry
    // where platformId matches and brandGapOnPlatform is true
    conditions.push(
      sql`${opportunity.platformBreakdown} @> ${JSON.stringify([{ platformId: filters.platformId, brandGapOnPlatform: true }])}::jsonb`
    );
  }

  // Date range or default to latest available periodStart
  if (filters.from || filters.to) {
    if (filters.from) {
      conditions.push(gte(opportunity.periodStart, filters.from));
    }
    if (filters.to) {
      conditions.push(sql`${opportunity.periodStart} <= ${filters.to}`);
    }
  } else {
    // Default to latest available date
    const [latestRow] = await db
      .select({ periodStart: opportunity.periodStart })
      .from(opportunity)
      .where(and(...conditions))
      .orderBy(desc(opportunity.periodStart))
      .limit(1);

    if (!latestRow) {
      return {
        items: [],
        total: 0,
        summary: { totalOpportunities: 0, missingCount: 0, weakCount: 0, averageScore: '0.00' },
      };
    }

    conditions.push(eq(opportunity.periodStart, latestRow.periodStart));
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total, summary] = await Promise.all([
    db
      .select({
        id: opportunity.id,
        workspaceId: opportunity.workspaceId,
        brandId: opportunity.brandId,
        promptSetId: opportunity.promptSetId,
        promptId: opportunity.promptId,
        promptText: prompt.template,
        periodStart: opportunity.periodStart,
        type: opportunity.type,
        score: opportunity.score,
        competitorCount: opportunity.competitorCount,
        totalTrackedBrands: opportunity.totalTrackedBrands,
        platformCount: opportunity.platformCount,
        brandCitationCount: opportunity.brandCitationCount,
        competitors: opportunity.competitors,
        platformBreakdown: opportunity.platformBreakdown,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      })
      .from(opportunity)
      .leftJoin(prompt, eq(opportunity.promptId, prompt.id))
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(opportunity.score))
      .limit(limit)
      .offset(offset),
    countTotal(opportunity, conditions),
    computeSummary(conditions),
  ]);

  return {
    items: items as OpportunityRow[],
    total,
    summary,
  };
}

async function computeSummary(conditions: SQL[]): Promise<OpportunitySummary> {
  const [result] = await db
    .select({
      totalOpportunities: sql<number>`COUNT(*)::int`.as('total_opportunities'),
      missingCount: sql<number>`COUNT(*) FILTER (WHERE ${opportunity.type} = 'missing')::int`.as(
        'missing_count'
      ),
      weakCount: sql<number>`COUNT(*) FILTER (WHERE ${opportunity.type} = 'weak')::int`.as(
        'weak_count'
      ),
      averageScore: sql<string>`COALESCE(ROUND(AVG(${opportunity.score}), 2)::text, '0.00')`.as(
        'average_score'
      ),
    })
    .from(opportunity)
    .where(and(...conditions));

  return {
    totalOpportunities: result?.totalOpportunities ?? 0,
    missingCount: result?.missingCount ?? 0,
    weakCount: result?.weakCount ?? 0,
    averageScore: result?.averageScore ?? '0.00',
  };
}
