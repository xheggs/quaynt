import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citationSourceAggregate } from './citation-source-aggregate.schema';
import { paginationConfig, sortConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import type { CitationSourceFilters } from './citation-source-aggregate.types';

const ALL_SENTINEL = '_all';

const SORT_COLUMNS: Record<string, Column> = {
  frequency: citationSourceAggregate.frequency,
  domain: citationSourceAggregate.domain,
  firstSeenAt: citationSourceAggregate.firstSeenAt,
  lastSeenAt: citationSourceAggregate.lastSeenAt,
  periodStart: citationSourceAggregate.periodStart,
};

export const CITATION_SOURCE_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

const sourceFields = {
  id: citationSourceAggregate.id,
  workspaceId: citationSourceAggregate.workspaceId,
  brandId: citationSourceAggregate.brandId,
  promptSetId: citationSourceAggregate.promptSetId,
  platformId: citationSourceAggregate.platformId,
  locale: citationSourceAggregate.locale,
  domain: citationSourceAggregate.domain,
  periodStart: citationSourceAggregate.periodStart,
  frequency: citationSourceAggregate.frequency,
  firstSeenAt: citationSourceAggregate.firstSeenAt,
  lastSeenAt: citationSourceAggregate.lastSeenAt,
  createdAt: citationSourceAggregate.createdAt,
  updatedAt: citationSourceAggregate.updatedAt,
};

export async function getCitationSources(
  workspaceId: string,
  filters: CitationSourceFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions: SQL[] = [eq(citationSourceAggregate.workspaceId, workspaceId)];

  conditions.push(eq(citationSourceAggregate.promptSetId, filters.promptSetId));

  if (filters.brandId) {
    conditions.push(eq(citationSourceAggregate.brandId, filters.brandId));
  }

  if (filters.platformId) {
    conditions.push(eq(citationSourceAggregate.platformId, filters.platformId));
  } else {
    conditions.push(eq(citationSourceAggregate.platformId, ALL_SENTINEL));
  }

  if (filters.locale) {
    conditions.push(eq(citationSourceAggregate.locale, filters.locale));
  } else {
    conditions.push(eq(citationSourceAggregate.locale, ALL_SENTINEL));
  }

  if (filters.domain) {
    conditions.push(eq(citationSourceAggregate.domain, filters.domain));
  }

  applyDateRange(
    conditions,
    { from: filters.from, to: filters.to },
    citationSourceAggregate.periodStart
  );

  const granularity = filters.granularity ?? 'day';

  if (granularity === 'day') {
    return getDailySources(conditions, pagination);
  }

  return getAggregatedSources(conditions, pagination, granularity);
}

async function getDailySources(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(sourceFields)
      .from(citationSourceAggregate)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(citationSourceAggregate.frequency))
      .limit(limit)
      .offset(offset),
    countTotal(citationSourceAggregate, conditions),
  ]);

  return { items, total };
}

async function getAggregatedSources(
  conditions: SQL[],
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  granularity: 'week' | 'month'
) {
  const { limit, offset } = paginationConfig(pagination);

  const truncatedDate = sql<string>`date_trunc(${granularity}, ${citationSourceAggregate.periodStart})::date`;

  const items = await db
    .select({
      periodStart: truncatedDate.as('period_start'),
      brandId: citationSourceAggregate.brandId,
      promptSetId: citationSourceAggregate.promptSetId,
      platformId: citationSourceAggregate.platformId,
      locale: citationSourceAggregate.locale,
      domain: citationSourceAggregate.domain,
      frequency: sql<number>`SUM(${citationSourceAggregate.frequency})::int`.as('frequency'),
      firstSeenAt: sql<Date>`MIN(${citationSourceAggregate.firstSeenAt})`.as('first_seen_at'),
      lastSeenAt: sql<Date>`MAX(${citationSourceAggregate.lastSeenAt})`.as('last_seen_at'),
    })
    .from(citationSourceAggregate)
    .where(and(...conditions))
    .groupBy(
      truncatedDate,
      citationSourceAggregate.brandId,
      citationSourceAggregate.promptSetId,
      citationSourceAggregate.platformId,
      citationSourceAggregate.locale,
      citationSourceAggregate.domain
    )
    .orderBy(sql`SUM(${citationSourceAggregate.frequency}) DESC`)
    .limit(limit)
    .offset(offset);

  // Count distinct groups for pagination total
  const [countResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(
      db
        .selectDistinct({
          period: truncatedDate,
          brandId: citationSourceAggregate.brandId,
          promptSetId: citationSourceAggregate.promptSetId,
          platformId: citationSourceAggregate.platformId,
          locale: citationSourceAggregate.locale,
          domain: citationSourceAggregate.domain,
        })
        .from(citationSourceAggregate)
        .where(and(...conditions))
        .as('distinct_groups')
    );

  return { items, total: countResult?.count ?? 0 };
}
