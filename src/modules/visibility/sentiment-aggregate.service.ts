import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sentimentAggregate } from './sentiment-aggregate.schema';
import { paginationConfig, sortConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import type { SentimentAggregateFilters } from './sentiment-aggregate.types';

const ALL_SENTINEL = '_all';

const SORT_COLUMNS: Record<string, Column> = {
  periodStart: sentimentAggregate.periodStart,
  netSentimentScore: sentimentAggregate.netSentimentScore,
  positivePercentage: sentimentAggregate.positivePercentage,
  negativePercentage: sentimentAggregate.negativePercentage,
  totalCount: sentimentAggregate.totalCount,
};

export const SENTIMENT_AGGREGATE_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

const sentimentFields = {
  id: sentimentAggregate.id,
  workspaceId: sentimentAggregate.workspaceId,
  brandId: sentimentAggregate.brandId,
  promptSetId: sentimentAggregate.promptSetId,
  platformId: sentimentAggregate.platformId,
  locale: sentimentAggregate.locale,
  periodStart: sentimentAggregate.periodStart,
  positiveCount: sentimentAggregate.positiveCount,
  neutralCount: sentimentAggregate.neutralCount,
  negativeCount: sentimentAggregate.negativeCount,
  totalCount: sentimentAggregate.totalCount,
  positivePercentage: sentimentAggregate.positivePercentage,
  neutralPercentage: sentimentAggregate.neutralPercentage,
  negativePercentage: sentimentAggregate.negativePercentage,
  netSentimentScore: sentimentAggregate.netSentimentScore,
  averageScore: sentimentAggregate.averageScore,
  modelRunCount: sentimentAggregate.modelRunCount,
  createdAt: sentimentAggregate.createdAt,
  updatedAt: sentimentAggregate.updatedAt,
};

export async function getSentimentAggregates(
  workspaceId: string,
  filters: SentimentAggregateFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions: SQL[] = [eq(sentimentAggregate.workspaceId, workspaceId)];

  conditions.push(eq(sentimentAggregate.promptSetId, filters.promptSetId));

  if (filters.brandId) {
    conditions.push(eq(sentimentAggregate.brandId, filters.brandId));
  }

  if (filters.platformId) {
    conditions.push(eq(sentimentAggregate.platformId, filters.platformId));
  } else {
    conditions.push(eq(sentimentAggregate.platformId, ALL_SENTINEL));
  }

  if (filters.locale) {
    conditions.push(eq(sentimentAggregate.locale, filters.locale));
  } else {
    conditions.push(eq(sentimentAggregate.locale, ALL_SENTINEL));
  }

  applyDateRange(
    conditions,
    { from: filters.from, to: filters.to },
    sentimentAggregate.periodStart
  );

  const granularity = filters.granularity ?? 'day';

  if (granularity === 'day') {
    return getDailySentiment(conditions, pagination);
  }

  return getAggregatedSentiment(conditions, pagination, granularity);
}

async function getDailySentiment(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(sentimentFields)
      .from(sentimentAggregate)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(sentimentAggregate.periodStart))
      .limit(limit)
      .offset(offset),
    countTotal(sentimentAggregate, conditions),
  ]);

  return { items, total };
}

async function getAggregatedSentiment(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  granularity: 'week' | 'month'
) {
  const { limit, offset } = paginationConfig(pagination);

  const truncatedDate = sql<string>`date_trunc(${granularity}, ${sentimentAggregate.periodStart})::date`;

  const items = await db
    .select({
      periodStart: truncatedDate.as('period_start'),
      brandId: sentimentAggregate.brandId,
      promptSetId: sentimentAggregate.promptSetId,
      platformId: sentimentAggregate.platformId,
      locale: sentimentAggregate.locale,
      positiveCount: sql<number>`SUM(${sentimentAggregate.positiveCount})::int`.as(
        'positive_count'
      ),
      neutralCount: sql<number>`SUM(${sentimentAggregate.neutralCount})::int`.as('neutral_count'),
      negativeCount: sql<number>`SUM(${sentimentAggregate.negativeCount})::int`.as(
        'negative_count'
      ),
      totalCount: sql<number>`SUM(${sentimentAggregate.totalCount})::int`.as('total_count'),
      positivePercentage: sql<string>`CASE WHEN SUM(${sentimentAggregate.totalCount}) > 0
        THEN ROUND(SUM(${sentimentAggregate.positiveCount})::numeric / SUM(${sentimentAggregate.totalCount}) * 100, 2)::text
        ELSE '0.00' END`.as('positive_percentage'),
      neutralPercentage: sql<string>`CASE WHEN SUM(${sentimentAggregate.totalCount}) > 0
        THEN ROUND(SUM(${sentimentAggregate.neutralCount})::numeric / SUM(${sentimentAggregate.totalCount}) * 100, 2)::text
        ELSE '0.00' END`.as('neutral_percentage'),
      negativePercentage: sql<string>`CASE WHEN SUM(${sentimentAggregate.totalCount}) > 0
        THEN ROUND(SUM(${sentimentAggregate.negativeCount})::numeric / SUM(${sentimentAggregate.totalCount}) * 100, 2)::text
        ELSE '0.00' END`.as('negative_percentage'),
      netSentimentScore: sql<string>`CASE WHEN SUM(${sentimentAggregate.totalCount}) > 0
        THEN ROUND((SUM(${sentimentAggregate.positiveCount}) - SUM(${sentimentAggregate.negativeCount}))::numeric / SUM(${sentimentAggregate.totalCount}) * 100, 2)::text
        ELSE '0.00' END`.as('net_sentiment_score'),
      averageScore: sql<string>`CASE WHEN SUM(${sentimentAggregate.totalCount}) > 0
        THEN ROUND(SUM(${sentimentAggregate.averageScore}::numeric * ${sentimentAggregate.totalCount}) / SUM(${sentimentAggregate.totalCount}), 4)::text
        ELSE NULL END`.as('average_score'),
      modelRunCount: sql<number>`SUM(${sentimentAggregate.modelRunCount})::int`.as(
        'model_run_count'
      ),
    })
    .from(sentimentAggregate)
    .where(and(...conditions))
    .groupBy(
      truncatedDate,
      sentimentAggregate.brandId,
      sentimentAggregate.promptSetId,
      sentimentAggregate.platformId,
      sentimentAggregate.locale
    )
    .orderBy(desc(truncatedDate))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(
      db
        .selectDistinct({
          period: truncatedDate,
          brandId: sentimentAggregate.brandId,
          promptSetId: sentimentAggregate.promptSetId,
          platformId: sentimentAggregate.platformId,
          locale: sentimentAggregate.locale,
        })
        .from(sentimentAggregate)
        .where(and(...conditions))
        .as('distinct_groups')
    );

  return { items, total: countResult?.count ?? 0 };
}

export async function getLatestSentiment(
  workspaceId: string,
  promptSetId: string,
  brandId?: string
) {
  const conditions: SQL[] = [
    eq(sentimentAggregate.workspaceId, workspaceId),
    eq(sentimentAggregate.promptSetId, promptSetId),
    eq(sentimentAggregate.platformId, ALL_SENTINEL),
    eq(sentimentAggregate.locale, ALL_SENTINEL),
  ];

  if (brandId) {
    conditions.push(eq(sentimentAggregate.brandId, brandId));
  }

  const [latestRow] = await db
    .select({ periodStart: sentimentAggregate.periodStart })
    .from(sentimentAggregate)
    .where(and(...conditions))
    .orderBy(desc(sentimentAggregate.periodStart))
    .limit(1);

  if (!latestRow) return [];

  conditions.push(eq(sentimentAggregate.periodStart, latestRow.periodStart));

  const items = await db
    .select(sentimentFields)
    .from(sentimentAggregate)
    .where(and(...conditions))
    .orderBy(desc(sentimentAggregate.netSentimentScore));

  return items;
}
