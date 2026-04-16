import { eq, and, ne, gte, lte, sql, count, countDistinct, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { crawlerDailyAggregate } from './crawler-aggregate.schema';
import { crawlerVisit } from './crawler-visit.schema';
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  TimeSeriesPoint,
  BotBreakdownEntry,
  TopPageEntry,
  CoverageGapEntry,
} from './crawler.types';

/**
 * Get KPI summary from aggregates.
 */
export async function getAnalyticsSummary(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsSummary> {
  const conditions = buildAggregateConditions(workspaceId, filters);

  // Get _all_ rollup for total visits
  const allConditions = [...conditions, eq(crawlerDailyAggregate.botName, '_all_')];

  const [totalRow] = await db
    .select({
      totalVisits: sql<number>`coalesce(sum(${crawlerDailyAggregate.visitCount}), 0)`,
    })
    .from(crawlerDailyAggregate)
    .where(and(...allConditions));

  // Get per-bot stats (exclude _all_ rollup)
  const botConditions = [...conditions, ne(crawlerDailyAggregate.botName, '_all_')];

  const [botStats] = await db
    .select({
      uniqueBots: countDistinct(crawlerDailyAggregate.botName),
      activeBots: countDistinct(crawlerDailyAggregate.botName),
    })
    .from(crawlerDailyAggregate)
    .where(and(...botConditions));

  // Get unique pages from _all_ rollup max
  const [pagesRow] = await db
    .select({
      uniquePages: sql<number>`coalesce(max(${crawlerDailyAggregate.uniquePaths}), 0)`,
    })
    .from(crawlerDailyAggregate)
    .where(and(...allConditions));

  return {
    totalVisits: totalRow?.totalVisits ?? 0,
    uniqueBots: botStats?.uniqueBots ?? 0,
    uniquePages: pagesRow?.uniquePages ?? 0,
    activeBots: botStats?.activeBots ?? 0,
  };
}

/**
 * Get daily time series with per-bot breakdown.
 */
export async function getTimeSeries(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<TimeSeriesPoint[]> {
  const conditions = buildAggregateConditions(workspaceId, filters);
  conditions.push(ne(crawlerDailyAggregate.botName, '_all_'));

  const rows = await db
    .select({
      date: crawlerDailyAggregate.periodStart,
      botName: crawlerDailyAggregate.botName,
      visits: crawlerDailyAggregate.visitCount,
    })
    .from(crawlerDailyAggregate)
    .where(and(...conditions))
    .orderBy(crawlerDailyAggregate.periodStart);

  return rows.map((r) => ({
    date: r.date,
    botName: r.botName,
    visits: r.visits,
  }));
}

/**
 * Get bot breakdown with visit counts, unique pages, and last seen date.
 */
export async function getBotBreakdown(
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<BotBreakdownEntry[]> {
  const conditions = buildAggregateConditions(workspaceId, filters);
  conditions.push(ne(crawlerDailyAggregate.botName, '_all_'));

  const rows = await db
    .select({
      botName: crawlerDailyAggregate.botName,
      botCategory: crawlerDailyAggregate.botCategory,
      visits: sql<number>`sum(${crawlerDailyAggregate.visitCount})`,
      uniquePages: sql<number>`max(${crawlerDailyAggregate.uniquePaths})`,
      lastSeen: max(crawlerDailyAggregate.periodStart),
    })
    .from(crawlerDailyAggregate)
    .where(and(...conditions))
    .groupBy(crawlerDailyAggregate.botName, crawlerDailyAggregate.botCategory)
    .orderBy(sql`sum(${crawlerDailyAggregate.visitCount}) DESC`);

  // Map bot names to operators via the dictionary
  const { getBotDictionary } = await import('./crawler-bot-dictionary');
  const dictionary = getBotDictionary();
  const operatorMap = new Map(dictionary.map((b) => [b.name, b.operator]));

  return rows.map((r) => ({
    botName: r.botName,
    operator: operatorMap.get(r.botName) ?? 'Unknown',
    category: r.botCategory as BotBreakdownEntry['category'],
    visits: r.visits,
    uniquePages: r.uniquePages,
    lastSeen: r.lastSeen ?? '',
  }));
}

/**
 * Get most crawled pages across bots.
 */
export async function getTopPages(
  workspaceId: string,
  filters: AnalyticsFilters,
  limit: number = 50
): Promise<TopPageEntry[]> {
  const conditions = buildVisitConditions(workspaceId, filters);

  const rows = await db
    .select({
      path: crawlerVisit.requestPath,
      totalVisits: count().as('total_visits'),
      botCount: countDistinct(crawlerVisit.botName).as('bot_count'),
      lastCrawled: max(crawlerVisit.visitedAt),
    })
    .from(crawlerVisit)
    .where(and(...conditions))
    .groupBy(crawlerVisit.requestPath)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return rows.map((r) => ({
    path: r.path,
    totalVisits: r.totalVisits,
    botCount: r.botCount,
    lastCrawled: r.lastCrawled?.toISOString() ?? '',
  }));
}

/**
 * Identify coverage gaps — pages that AI bots have stopped visiting.
 *
 * Algorithm:
 * 1. If sitemapPaths provided: return sitemap paths with zero visits in from→to range.
 * 2. If no sitemap: find pages that received >=3 visits in the 30 days before `from`
 *    but zero visits in the from→to range. Limited to top 100 gaps.
 */
export async function getCoverageGaps(
  workspaceId: string,
  filters: AnalyticsFilters,
  sitemapPaths?: string[]
): Promise<CoverageGapEntry[]> {
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  if (sitemapPaths && sitemapPaths.length > 0) {
    return getSitemapCoverageGaps(workspaceId, fromDate, toDate, sitemapPaths);
  }

  return getHistoricalCoverageGaps(workspaceId, fromDate, toDate);
}

async function getSitemapCoverageGaps(
  workspaceId: string,
  from: Date,
  to: Date,
  sitemapPaths: string[]
): Promise<CoverageGapEntry[]> {
  // Find which sitemap paths have visits in the range
  const visitedPaths = await db
    .selectDistinct({ path: crawlerVisit.requestPath })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, from),
        lte(crawlerVisit.visitedAt, to)
      )
    );

  const visitedSet = new Set(visitedPaths.map((r) => r.path));

  // Find last crawl date for missing paths
  const gaps: CoverageGapEntry[] = [];
  for (const path of sitemapPaths) {
    if (visitedSet.has(path)) continue;

    const [lastVisit] = await db
      .select({ lastCrawled: max(crawlerVisit.visitedAt) })
      .from(crawlerVisit)
      .where(and(eq(crawlerVisit.workspaceId, workspaceId), eq(crawlerVisit.requestPath, path)));

    const lastCrawled = lastVisit?.lastCrawled;
    const daysSince = lastCrawled
      ? Math.floor((Date.now() - lastCrawled.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    gaps.push({
      path,
      lastCrawled: lastCrawled?.toISOString() ?? '',
      daysSince,
    });
  }

  return gaps.sort((a, b) => b.daysSince - a.daysSince).slice(0, 100);
}

async function getHistoricalCoverageGaps(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<CoverageGapEntry[]> {
  // Get pages with >=3 visits in the 30 days before `from`
  const priorStart = new Date(from);
  priorStart.setDate(priorStart.getDate() - 30);

  const previouslyActive = await db
    .select({
      path: crawlerVisit.requestPath,
      visitCount: count().as('visit_count'),
      lastCrawled: max(crawlerVisit.visitedAt),
    })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, priorStart),
        lte(crawlerVisit.visitedAt, from)
      )
    )
    .groupBy(crawlerVisit.requestPath)
    .having(sql`count(*) >= 3`);

  if (previouslyActive.length === 0) return [];

  // Check which of these paths have zero visits in the current range
  const currentVisits = await db
    .selectDistinct({ path: crawlerVisit.requestPath })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, from),
        lte(crawlerVisit.visitedAt, to)
      )
    );

  const currentSet = new Set(currentVisits.map((r) => r.path));

  const gaps: CoverageGapEntry[] = previouslyActive
    .filter((r) => !currentSet.has(r.path))
    .map((r) => ({
      path: r.path,
      lastCrawled: r.lastCrawled?.toISOString() ?? '',
      daysSince: r.lastCrawled
        ? Math.floor((Date.now() - r.lastCrawled.getTime()) / (1000 * 60 * 60 * 24))
        : -1,
    }))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 100);

  return gaps;
}

// --- Helpers ---

function buildAggregateConditions(workspaceId: string, filters: AnalyticsFilters) {
  const conditions = [eq(crawlerDailyAggregate.workspaceId, workspaceId)];

  if (filters.from) {
    conditions.push(gte(crawlerDailyAggregate.periodStart, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(crawlerDailyAggregate.periodStart, filters.to));
  }
  if (filters.botName) {
    conditions.push(eq(crawlerDailyAggregate.botName, filters.botName));
  }
  if (filters.botCategory) {
    conditions.push(eq(crawlerDailyAggregate.botCategory, filters.botCategory));
  }

  return conditions;
}

function buildVisitConditions(workspaceId: string, filters: AnalyticsFilters) {
  const conditions = [eq(crawlerVisit.workspaceId, workspaceId)];

  if (filters.from) {
    conditions.push(gte(crawlerVisit.visitedAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(crawlerVisit.visitedAt, new Date(filters.to)));
  }
  if (filters.botName) {
    conditions.push(eq(crawlerVisit.botName, filters.botName));
  }
  if (filters.botCategory) {
    conditions.push(eq(crawlerVisit.botCategory, filters.botCategory));
  }

  return conditions;
}
