import { and, eq, gte, lte, ne, sql, max, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { trafficDailyAggregate } from './traffic-aggregate.schema';
import { aiVisit } from './ai-visit.schema';
import { getPlatformDisplayName } from './ai-source-dictionary';
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  TimeSeriesPoint,
  PlatformBreakdownEntry,
  TopPageEntry,
} from './traffic.types';

const ALL = '_all_';

/**
 * Summary KPIs for the dashboard header. Reads from the pre-computed aggregate table
 * and falls back to zeros when there is no data yet.
 */
export async function getAnalyticsSummary(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsSummary> {
  const conditions = buildAggregateConditions(workspaceId, filters);

  // Workspace-wide total from the (_all_, _all_) row.
  const totalConditions = [
    ...conditions,
    eq(trafficDailyAggregate.source, ALL),
    eq(trafficDailyAggregate.platform, ALL),
  ];
  const [totalRow] = await db
    .select({
      totalVisits: sql<number>`coalesce(sum(${trafficDailyAggregate.visitCount}), 0)`,
    })
    .from(trafficDailyAggregate)
    .where(and(...totalConditions));

  // Per-platform rollup (source='_all_', platform != '_all_').
  const platformConditions = [
    ...conditions,
    eq(trafficDailyAggregate.source, ALL),
    ne(trafficDailyAggregate.platform, ALL),
  ];
  const platformRows = await db
    .select({
      platform: trafficDailyAggregate.platform,
      visits: sql<number>`sum(${trafficDailyAggregate.visitCount})`,
    })
    .from(trafficDailyAggregate)
    .where(and(...platformConditions))
    .groupBy(trafficDailyAggregate.platform)
    .orderBy(desc(sql`sum(${trafficDailyAggregate.visitCount})`));

  // Top landing page across the workspace — use the raw ai_visit table to avoid the
  // per-source-per-platform limit in topPages.
  const visitConditions: SQL[] = [eq(aiVisit.workspaceId, workspaceId)];
  if (filters.from) visitConditions.push(gte(aiVisit.visitedAt, new Date(filters.from)));
  if (filters.to) visitConditions.push(lte(aiVisit.visitedAt, new Date(filters.to)));
  const [topPageRow] = await db
    .select({
      path: aiVisit.landingPath,
      visits: sql<number>`count(*)`,
    })
    .from(aiVisit)
    .where(and(...visitConditions))
    .groupBy(aiVisit.landingPath)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  return {
    totalVisits: totalRow?.totalVisits ?? 0,
    topPlatform: platformRows[0]?.platform ?? null,
    topLandingPage: topPageRow?.path ?? null,
    distinctPlatforms: platformRows.length,
  };
}

/**
 * Daily per-platform time series for the primary chart.
 */
export async function getTimeSeries(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<TimeSeriesPoint[]> {
  const conditions = buildAggregateConditions(workspaceId, filters);
  conditions.push(eq(trafficDailyAggregate.source, ALL));
  conditions.push(ne(trafficDailyAggregate.platform, ALL));

  const rows = await db
    .select({
      date: trafficDailyAggregate.periodStart,
      platform: trafficDailyAggregate.platform,
      visits: trafficDailyAggregate.visitCount,
    })
    .from(trafficDailyAggregate)
    .where(and(...conditions))
    .orderBy(trafficDailyAggregate.periodStart);

  return rows.map((r) => ({ date: r.date, platform: r.platform, visits: r.visits }));
}

/**
 * Per-platform breakdown with trend vs. the prior period of equal length.
 */
export async function getPlatformBreakdown(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<PlatformBreakdownEntry[]> {
  const currentConditions = buildAggregateConditions(workspaceId, filters);
  currentConditions.push(eq(trafficDailyAggregate.source, ALL));
  currentConditions.push(ne(trafficDailyAggregate.platform, ALL));

  const current = await db
    .select({
      platform: trafficDailyAggregate.platform,
      visits: sql<number>`sum(${trafficDailyAggregate.visitCount})`,
      uniquePages: sql<number>`max(${trafficDailyAggregate.uniquePages})`,
      lastVisit: max(trafficDailyAggregate.periodStart),
    })
    .from(trafficDailyAggregate)
    .where(and(...currentConditions))
    .groupBy(trafficDailyAggregate.platform)
    .orderBy(desc(sql`sum(${trafficDailyAggregate.visitCount})`));

  const priorMap = await getPriorPeriodVisits(workspaceId, filters);

  return current.map((r) => ({
    platform: r.platform,
    displayName: getPlatformDisplayName(r.platform),
    visits: r.visits,
    uniquePages: r.uniquePages,
    lastVisit: r.lastVisit ?? null,
    priorPeriodVisits: priorMap.get(r.platform) ?? 0,
  }));
}

/**
 * Top landing pages across the workspace from the raw ai_visit table.
 */
export async function getTopLandingPages(
  workspaceId: string,
  filters: AnalyticsFilters,
  limit = 20
): Promise<TopPageEntry[]> {
  const conditions: SQL[] = [eq(aiVisit.workspaceId, workspaceId)];
  if (filters.from) conditions.push(gte(aiVisit.visitedAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(aiVisit.visitedAt, new Date(filters.to)));
  if (filters.platform) conditions.push(eq(aiVisit.platform, filters.platform));
  if (filters.source) conditions.push(eq(aiVisit.source, filters.source));

  const rows = await db
    .select({
      path: aiVisit.landingPath,
      visits: sql<number>`count(*)`,
      platforms: sql<string[]>`array_agg(distinct ${aiVisit.platform})`,
    })
    .from(aiVisit)
    .where(and(...conditions))
    .groupBy(aiVisit.landingPath)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({
    path: r.path,
    visits: r.visits,
    platforms: r.platforms ?? [],
  }));
}

function buildAggregateConditions(workspaceId: string, filters: AnalyticsFilters): SQL[] {
  const conditions: SQL[] = [eq(trafficDailyAggregate.workspaceId, workspaceId)];
  if (filters.from) conditions.push(gte(trafficDailyAggregate.periodStart, filters.from));
  if (filters.to) conditions.push(lte(trafficDailyAggregate.periodStart, filters.to));
  if (filters.platform && filters.platform !== ALL)
    conditions.push(eq(trafficDailyAggregate.platform, filters.platform));
  if (filters.source) conditions.push(eq(trafficDailyAggregate.source, filters.source));
  return conditions;
}

async function getPriorPeriodVisits(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<Map<string, number>> {
  if (!filters.from || !filters.to) return new Map();

  const from = new Date(filters.from);
  const to = new Date(filters.to);
  const windowMs = to.getTime() - from.getTime();
  if (windowMs <= 0) return new Map();

  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(from.getTime() - windowMs);

  const rows = await db
    .select({
      platform: trafficDailyAggregate.platform,
      visits: sql<number>`sum(${trafficDailyAggregate.visitCount})`,
    })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.source, ALL),
        ne(trafficDailyAggregate.platform, ALL),
        gte(trafficDailyAggregate.periodStart, priorFrom.toISOString().slice(0, 10)),
        lte(trafficDailyAggregate.periodStart, priorTo.toISOString().slice(0, 10))
      )
    )
    .groupBy(trafficDailyAggregate.platform);

  return new Map(rows.map((r) => [r.platform, r.visits]));
}
