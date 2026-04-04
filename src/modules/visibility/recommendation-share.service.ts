import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recommendationShare } from './recommendation-share.schema';
import { paginationConfig, sortConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import type { RecommendationShareFilters } from './recommendation-share.types';

const ALL_SENTINEL = '_all';

const SORT_COLUMNS: Record<string, Column> = {
  periodStart: recommendationShare.periodStart,
  sharePercentage: recommendationShare.sharePercentage,
  citationCount: recommendationShare.citationCount,
};

export const RECOMMENDATION_SHARE_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

const shareFields = {
  id: recommendationShare.id,
  workspaceId: recommendationShare.workspaceId,
  brandId: recommendationShare.brandId,
  promptSetId: recommendationShare.promptSetId,
  platformId: recommendationShare.platformId,
  locale: recommendationShare.locale,
  periodStart: recommendationShare.periodStart,
  sharePercentage: recommendationShare.sharePercentage,
  citationCount: recommendationShare.citationCount,
  totalCitations: recommendationShare.totalCitations,
  modelRunCount: recommendationShare.modelRunCount,
  createdAt: recommendationShare.createdAt,
  updatedAt: recommendationShare.updatedAt,
};

export async function getRecommendationShare(
  workspaceId: string,
  filters: RecommendationShareFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions: SQL[] = [eq(recommendationShare.workspaceId, workspaceId)];

  conditions.push(eq(recommendationShare.promptSetId, filters.promptSetId));

  if (filters.brandId) {
    conditions.push(eq(recommendationShare.brandId, filters.brandId));
  }

  // Default to aggregate rows when no specific platform/locale filter
  if (filters.platformId) {
    conditions.push(eq(recommendationShare.platformId, filters.platformId));
  } else {
    conditions.push(eq(recommendationShare.platformId, ALL_SENTINEL));
  }

  if (filters.locale) {
    conditions.push(eq(recommendationShare.locale, filters.locale));
  } else {
    conditions.push(eq(recommendationShare.locale, ALL_SENTINEL));
  }

  applyDateRange(
    conditions,
    { from: filters.from, to: filters.to },
    recommendationShare.periodStart
  );

  const granularity = filters.granularity ?? 'day';

  if (granularity === 'day') {
    return getDailyShare(conditions, pagination);
  }

  return getAggregatedShare(conditions, pagination, granularity);
}

async function getDailyShare(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(shareFields)
      .from(recommendationShare)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(recommendationShare.periodStart))
      .limit(limit)
      .offset(offset),
    countTotal(recommendationShare, conditions),
  ]);

  return { items, total };
}

async function getAggregatedShare(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  granularity: 'week' | 'month'
) {
  const { limit, offset } = paginationConfig(pagination);

  const truncatedDate = sql<string>`date_trunc(${granularity}, ${recommendationShare.periodStart})::date`;

  const items = await db
    .select({
      periodStart: truncatedDate.as('period_start'),
      brandId: recommendationShare.brandId,
      promptSetId: recommendationShare.promptSetId,
      platformId: recommendationShare.platformId,
      locale: recommendationShare.locale,
      citationCount: sql<number>`SUM(${recommendationShare.citationCount})::int`.as(
        'citation_count'
      ),
      totalCitations: sql<number>`SUM(${recommendationShare.totalCitations})::int`.as(
        'total_citations'
      ),
      sharePercentage: sql<string>`CASE WHEN SUM(${recommendationShare.totalCitations}) > 0
        THEN ROUND(SUM(${recommendationShare.citationCount})::numeric / SUM(${recommendationShare.totalCitations}) * 100, 2)::text
        ELSE '0.00' END`.as('share_percentage'),
      modelRunCount: sql<number>`SUM(${recommendationShare.modelRunCount})::int`.as(
        'model_run_count'
      ),
    })
    .from(recommendationShare)
    .where(and(...conditions))
    .groupBy(
      truncatedDate,
      recommendationShare.brandId,
      recommendationShare.promptSetId,
      recommendationShare.platformId,
      recommendationShare.locale
    )
    .orderBy(desc(truncatedDate))
    .limit(limit)
    .offset(offset);

  // For total count with aggregation, we need a count of distinct groups
  const [countResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(
      db
        .selectDistinct({
          period: truncatedDate,
          brandId: recommendationShare.brandId,
          promptSetId: recommendationShare.promptSetId,
          platformId: recommendationShare.platformId,
          locale: recommendationShare.locale,
        })
        .from(recommendationShare)
        .where(and(...conditions))
        .as('distinct_groups')
    );

  return { items, total: countResult?.count ?? 0 };
}

export async function getLatestRecommendationShare(
  workspaceId: string,
  promptSetId: string,
  brandId?: string
) {
  const conditions: SQL[] = [
    eq(recommendationShare.workspaceId, workspaceId),
    eq(recommendationShare.promptSetId, promptSetId),
    eq(recommendationShare.platformId, ALL_SENTINEL),
    eq(recommendationShare.locale, ALL_SENTINEL),
  ];

  if (brandId) {
    conditions.push(eq(recommendationShare.brandId, brandId));
  }

  // Get the most recent date
  const [latestRow] = await db
    .select({ periodStart: recommendationShare.periodStart })
    .from(recommendationShare)
    .where(and(...conditions))
    .orderBy(desc(recommendationShare.periodStart))
    .limit(1);

  if (!latestRow) return [];

  // Get all brands for that date
  conditions.push(eq(recommendationShare.periodStart, latestRow.periodStart));

  const items = await db
    .select(shareFields)
    .from(recommendationShare)
    .where(and(...conditions))
    .orderBy(desc(recommendationShare.sharePercentage));

  return items;
}
