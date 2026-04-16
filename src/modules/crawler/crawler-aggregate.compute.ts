import { eq, and, gte, lt, sql, count, countDistinct, avg } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { crawlerVisit } from './crawler-visit.schema';
import { crawlerDailyAggregate } from './crawler-aggregate.schema';

const log = logger.child({ module: 'crawler-aggregate' });

interface BotAggregate {
  botName: string;
  botCategory: string;
  visitCount: number;
  uniquePaths: number;
  avgResponseBytes: string;
  statusBreakdown: Record<string, number>;
  topPaths: Array<{ path: string; count: number }>;
}

/**
 * Compute daily aggregates for a workspace on a specific date.
 * Creates per-bot rows and an `_all_` rollup row via upsert.
 */
export async function computeDailyAggregate(workspaceId: string, date: string): Promise<void> {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // Get per-bot stats
  const botStats = await db
    .select({
      botName: crawlerVisit.botName,
      botCategory: crawlerVisit.botCategory,
      visitCount: count().as('visit_count'),
      uniquePaths: countDistinct(crawlerVisit.requestPath).as('unique_paths'),
      avgResponseBytes: avg(crawlerVisit.responseBytes).as('avg_response_bytes'),
    })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, dayStart),
        lt(crawlerVisit.visitedAt, dayEnd)
      )
    )
    .groupBy(crawlerVisit.botName, crawlerVisit.botCategory);

  if (botStats.length === 0) {
    log.debug({ workspaceId, date }, 'No visits found for date, skipping aggregation');
    return;
  }

  // Get status breakdown per bot
  const statusRows = await db
    .select({
      botName: crawlerVisit.botName,
      statusCode: crawlerVisit.statusCode,
      count: count().as('count'),
    })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, dayStart),
        lt(crawlerVisit.visitedAt, dayEnd)
      )
    )
    .groupBy(crawlerVisit.botName, crawlerVisit.statusCode);

  // Get top paths per bot (top 20)
  const topPathRows = await db
    .select({
      botName: crawlerVisit.botName,
      path: crawlerVisit.requestPath,
      count: count().as('count'),
    })
    .from(crawlerVisit)
    .where(
      and(
        eq(crawlerVisit.workspaceId, workspaceId),
        gte(crawlerVisit.visitedAt, dayStart),
        lt(crawlerVisit.visitedAt, dayEnd)
      )
    )
    .groupBy(crawlerVisit.botName, crawlerVisit.requestPath)
    .orderBy(sql`count(*) DESC`);

  // Build status breakdown map per bot
  const statusByBot = new Map<string, Record<string, number>>();
  for (const row of statusRows) {
    const existing = statusByBot.get(row.botName) ?? {};
    existing[String(row.statusCode)] = row.count;
    statusByBot.set(row.botName, existing);
  }

  // Build top paths map per bot (limit 20 per bot)
  const pathsByBot = new Map<string, Array<{ path: string; count: number }>>();
  for (const row of topPathRows) {
    const existing = pathsByBot.get(row.botName) ?? [];
    if (existing.length < 20) {
      existing.push({ path: row.path, count: row.count });
    }
    pathsByBot.set(row.botName, existing);
  }

  // Build per-bot aggregates
  const aggregates: BotAggregate[] = botStats.map((stat) => ({
    botName: stat.botName,
    botCategory: stat.botCategory,
    visitCount: stat.visitCount,
    uniquePaths: stat.uniquePaths,
    avgResponseBytes: stat.avgResponseBytes ?? '0',
    statusBreakdown: statusByBot.get(stat.botName) ?? {},
    topPaths: pathsByBot.get(stat.botName) ?? [],
  }));

  // Compute _all_ rollup
  let totalVisits = 0;
  const allStatusBreakdown: Record<string, number> = {};
  const allPathCounts = new Map<string, number>();

  for (const agg of aggregates) {
    totalVisits += agg.visitCount;
    for (const [status, cnt] of Object.entries(agg.statusBreakdown)) {
      allStatusBreakdown[status] = (allStatusBreakdown[status] ?? 0) + cnt;
    }
    for (const tp of agg.topPaths) {
      allPathCounts.set(tp.path, (allPathCounts.get(tp.path) ?? 0) + tp.count);
    }
  }

  const allTopPaths = [...allPathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, cnt]) => ({ path, count: cnt }));

  const allUniquePaths = new Set(aggregates.flatMap((a) => a.topPaths.map((p) => p.path))).size;

  aggregates.push({
    botName: '_all_',
    botCategory: '_all_',
    visitCount: totalVisits,
    uniquePaths: allUniquePaths,
    avgResponseBytes: '0',
    statusBreakdown: allStatusBreakdown,
    topPaths: allTopPaths,
  });

  // Upsert all aggregates
  for (const agg of aggregates) {
    await db
      .insert(crawlerDailyAggregate)
      .values({
        workspaceId,
        periodStart: date,
        botName: agg.botName,
        botCategory: agg.botCategory,
        visitCount: agg.visitCount,
        uniquePaths: agg.uniquePaths,
        avgResponseBytes: agg.avgResponseBytes,
        statusBreakdown: agg.statusBreakdown,
        topPaths: agg.topPaths,
      })
      .onConflictDoUpdate({
        target: [
          crawlerDailyAggregate.workspaceId,
          crawlerDailyAggregate.periodStart,
          crawlerDailyAggregate.botName,
          crawlerDailyAggregate.botCategory,
        ],
        set: {
          visitCount: agg.visitCount,
          uniquePaths: agg.uniquePaths,
          avgResponseBytes: agg.avgResponseBytes,
          statusBreakdown: agg.statusBreakdown,
          topPaths: agg.topPaths,
        },
      });
  }

  log.info(
    { workspaceId, date, botCount: aggregates.length - 1, totalVisits },
    'Daily aggregates computed'
  );
}
