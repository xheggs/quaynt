import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { positionAggregate } from './position-aggregate.schema';
import { paginationConfig, sortConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import type { PositionAggregateFilters, PositionSummary } from './position-aggregate.types';

const ALL_SENTINEL = '_all';

const SORT_COLUMNS: Record<string, Column> = {
  periodStart: positionAggregate.periodStart,
  averagePosition: positionAggregate.averagePosition,
  medianPosition: positionAggregate.medianPosition,
  firstMentionRate: positionAggregate.firstMentionRate,
  topThreeRate: positionAggregate.topThreeRate,
  citationCount: positionAggregate.citationCount,
};

export const POSITION_AGGREGATE_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

const positionFields = {
  id: positionAggregate.id,
  workspaceId: positionAggregate.workspaceId,
  brandId: positionAggregate.brandId,
  promptSetId: positionAggregate.promptSetId,
  platformId: positionAggregate.platformId,
  locale: positionAggregate.locale,
  periodStart: positionAggregate.periodStart,
  citationCount: positionAggregate.citationCount,
  averagePosition: positionAggregate.averagePosition,
  medianPosition: positionAggregate.medianPosition,
  minPosition: positionAggregate.minPosition,
  maxPosition: positionAggregate.maxPosition,
  firstMentionCount: positionAggregate.firstMentionCount,
  firstMentionRate: positionAggregate.firstMentionRate,
  topThreeCount: positionAggregate.topThreeCount,
  topThreeRate: positionAggregate.topThreeRate,
  positionDistribution: positionAggregate.positionDistribution,
  modelRunCount: positionAggregate.modelRunCount,
  createdAt: positionAggregate.createdAt,
  updatedAt: positionAggregate.updatedAt,
};

export async function getPositionAggregates(
  workspaceId: string,
  filters: PositionAggregateFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions: SQL[] = [eq(positionAggregate.workspaceId, workspaceId)];

  conditions.push(eq(positionAggregate.promptSetId, filters.promptSetId));

  if (filters.brandId) {
    conditions.push(eq(positionAggregate.brandId, filters.brandId));
  }

  if (filters.platformId) {
    conditions.push(eq(positionAggregate.platformId, filters.platformId));
  } else {
    conditions.push(eq(positionAggregate.platformId, ALL_SENTINEL));
  }

  if (filters.locale) {
    conditions.push(eq(positionAggregate.locale, filters.locale));
  } else {
    conditions.push(eq(positionAggregate.locale, ALL_SENTINEL));
  }

  applyDateRange(conditions, { from: filters.from, to: filters.to }, positionAggregate.periodStart);

  const granularity = filters.granularity ?? 'day';

  // Build summary conditions: always use (_all, _all) level to avoid double-counting
  const summaryConditions: SQL[] = [
    eq(positionAggregate.workspaceId, workspaceId),
    eq(positionAggregate.promptSetId, filters.promptSetId),
    eq(positionAggregate.platformId, ALL_SENTINEL),
    eq(positionAggregate.locale, ALL_SENTINEL),
  ];

  if (filters.brandId) {
    summaryConditions.push(eq(positionAggregate.brandId, filters.brandId));
  }

  applyDateRange(
    summaryConditions,
    { from: filters.from, to: filters.to },
    positionAggregate.periodStart
  );

  if (granularity === 'day') {
    const [result, summary] = await Promise.all([
      getDailyPositions(conditions, pagination),
      computeSummary(summaryConditions),
    ]);
    return { ...result, summary };
  }

  const [result, summary] = await Promise.all([
    getAggregatedPositions(conditions, pagination, granularity),
    computeSummary(summaryConditions),
  ]);
  return { ...result, summary };
}

async function getDailyPositions(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(positionFields)
      .from(positionAggregate)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(positionAggregate.periodStart))
      .limit(limit)
      .offset(offset),
    countTotal(positionAggregate, conditions),
  ]);

  return { items, total };
}

async function getAggregatedPositions(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  granularity: 'week' | 'month'
) {
  const { limit, offset } = paginationConfig(pagination);

  const truncatedDate = sql<string>`date_trunc(${granularity}, ${positionAggregate.periodStart})::date`;

  // Fetch daily rows within the conditions to merge distributions in application code
  const dailyRows = await db
    .select({
      periodStart: truncatedDate.as('period_start'),
      brandId: positionAggregate.brandId,
      positionDistribution: positionAggregate.positionDistribution,
    })
    .from(positionAggregate)
    .where(and(...conditions));

  // Build merged distributions keyed by (period, brandId)
  const distMap = new Map<string, Record<string, number>>();
  for (const row of dailyRows) {
    const key = `${row.periodStart}:${row.brandId}`;
    const merged = distMap.get(key) ?? {};
    const dist = row.positionDistribution as Record<string, number>;
    for (const [pos, count] of Object.entries(dist)) {
      merged[pos] = (merged[pos] ?? 0) + count;
    }
    distMap.set(key, merged);
  }

  const items = await db
    .select({
      periodStart: truncatedDate.as('period_start'),
      brandId: positionAggregate.brandId,
      promptSetId: positionAggregate.promptSetId,
      platformId: positionAggregate.platformId,
      locale: positionAggregate.locale,
      citationCount: sql<number>`SUM(${positionAggregate.citationCount})::int`.as('citation_count'),
      averagePosition: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.averagePosition}::numeric * ${positionAggregate.citationCount}) / SUM(${positionAggregate.citationCount}), 2)::text
        ELSE '0.00' END`.as('average_position'),
      medianPosition: sql<string | null>`NULL`.as('median_position'),
      minPosition: sql<number>`MIN(${positionAggregate.minPosition})::int`.as('min_position'),
      maxPosition: sql<number>`MAX(${positionAggregate.maxPosition})::int`.as('max_position'),
      firstMentionCount: sql<number>`SUM(${positionAggregate.firstMentionCount})::int`.as(
        'first_mention_count'
      ),
      firstMentionRate: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.firstMentionCount})::numeric / SUM(${positionAggregate.citationCount}) * 100, 2)::text
        ELSE '0.00' END`.as('first_mention_rate'),
      topThreeCount: sql<number>`SUM(${positionAggregate.topThreeCount})::int`.as(
        'top_three_count'
      ),
      topThreeRate: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.topThreeCount})::numeric / SUM(${positionAggregate.citationCount}) * 100, 2)::text
        ELSE '0.00' END`.as('top_three_rate'),
      modelRunCount: sql<number>`SUM(${positionAggregate.modelRunCount})::int`.as(
        'model_run_count'
      ),
    })
    .from(positionAggregate)
    .where(and(...conditions))
    .groupBy(
      truncatedDate,
      positionAggregate.brandId,
      positionAggregate.promptSetId,
      positionAggregate.platformId,
      positionAggregate.locale
    )
    .orderBy(desc(truncatedDate))
    .limit(limit)
    .offset(offset);

  // Attach merged distributions to items
  const itemsWithDist = items.map((item) => ({
    ...item,
    positionDistribution: distMap.get(`${item.periodStart}:${item.brandId}`) ?? {},
  }));

  // Count distinct groups for pagination
  const [countResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(
      db
        .selectDistinct({
          period: truncatedDate,
          brandId: positionAggregate.brandId,
          promptSetId: positionAggregate.promptSetId,
          platformId: positionAggregate.platformId,
          locale: positionAggregate.locale,
        })
        .from(positionAggregate)
        .where(and(...conditions))
        .as('distinct_groups')
    );

  return { items: itemsWithDist, total: countResult?.count ?? 0 };
}

async function computeSummary(conditions: SQL[]): Promise<PositionSummary> {
  const [result] = await db
    .select({
      totalCitations: sql<number>`COALESCE(SUM(${positionAggregate.citationCount}), 0)::int`.as(
        'total_citations'
      ),
      overallAveragePosition: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.averagePosition}::numeric * ${positionAggregate.citationCount}) / SUM(${positionAggregate.citationCount}), 2)::text
        ELSE '0.00' END`.as('overall_average_position'),
      overallFirstMentionRate: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.firstMentionCount})::numeric / SUM(${positionAggregate.citationCount}) * 100, 2)::text
        ELSE '0.00' END`.as('overall_first_mention_rate'),
      overallTopThreeRate: sql<string>`CASE WHEN SUM(${positionAggregate.citationCount}) > 0
        THEN ROUND(SUM(${positionAggregate.topThreeCount})::numeric / SUM(${positionAggregate.citationCount}) * 100, 2)::text
        ELSE '0.00' END`.as('overall_top_three_rate'),
      brandsTracked: sql<number>`COUNT(DISTINCT ${positionAggregate.brandId})::int`.as(
        'brands_tracked'
      ),
    })
    .from(positionAggregate)
    .where(and(...conditions));

  return {
    totalCitations: result?.totalCitations ?? 0,
    overallAveragePosition: result?.overallAveragePosition ?? '0.00',
    overallFirstMentionRate: result?.overallFirstMentionRate ?? '0.00',
    overallTopThreeRate: result?.overallTopThreeRate ?? '0.00',
    brandsTracked: result?.brandsTracked ?? 0,
  };
}
