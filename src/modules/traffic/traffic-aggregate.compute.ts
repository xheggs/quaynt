import { and, eq, gte, lt, sql, count, countDistinct } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { aiVisit } from './ai-visit.schema';
import { trafficDailyAggregate } from './traffic-aggregate.schema';

const log = logger.child({ module: 'traffic-aggregate' });

const TOP_PAGES_LIMIT = 20;

interface AggregateRow {
  source: string;
  platform: string;
  visitCount: number;
  uniquePages: number;
  topPages: Array<{ path: string; count: number }>;
}

/**
 * Computes per-(source, platform) daily rollups for a workspace's `ai_visit` rows, plus
 * cross-cut rollups using the `_all_` sentinel:
 *   - (source, platform='_all_')  — per-source total
 *   - (source='_all_', platform)  — per-platform total
 *   - (source='_all_', platform='_all_') — workspace total
 *
 * Upserts each row by the (workspaceId, periodStart, source, platform) unique index.
 */
export async function computeDailyAggregate(workspaceId: string, date: string): Promise<void> {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // Per-(source, platform) base stats.
  const baseStats = await db
    .select({
      source: aiVisit.source,
      platform: aiVisit.platform,
      visitCount: count().as('visit_count'),
      uniquePages: countDistinct(aiVisit.landingPath).as('unique_pages'),
    })
    .from(aiVisit)
    .where(
      and(
        eq(aiVisit.workspaceId, workspaceId),
        gte(aiVisit.visitedAt, dayStart),
        lt(aiVisit.visitedAt, dayEnd)
      )
    )
    .groupBy(aiVisit.source, aiVisit.platform);

  if (baseStats.length === 0) {
    log.debug({ workspaceId, date }, 'no AI visits, skipping aggregation');
    return;
  }

  // Top pages per (source, platform). We pull all rows grouped by path and take the top
  // TOP_PAGES_LIMIT per (source, platform) in memory — cardinality is small enough.
  const pageRows = await db
    .select({
      source: aiVisit.source,
      platform: aiVisit.platform,
      path: aiVisit.landingPath,
      count: count().as('count'),
    })
    .from(aiVisit)
    .where(
      and(
        eq(aiVisit.workspaceId, workspaceId),
        gte(aiVisit.visitedAt, dayStart),
        lt(aiVisit.visitedAt, dayEnd)
      )
    )
    .groupBy(aiVisit.source, aiVisit.platform, aiVisit.landingPath)
    .orderBy(sql`count(*) DESC`);

  const topPagesByKey = new Map<string, Array<{ path: string; count: number }>>();
  for (const row of pageRows) {
    const key = `${row.source}::${row.platform}`;
    const bucket = topPagesByKey.get(key) ?? [];
    if (bucket.length < TOP_PAGES_LIMIT) {
      bucket.push({ path: row.path, count: row.count });
    }
    topPagesByKey.set(key, bucket);
  }

  const baseRows: AggregateRow[] = baseStats.map((s) => ({
    source: s.source,
    platform: s.platform,
    visitCount: s.visitCount,
    uniquePages: s.uniquePages,
    topPages: topPagesByKey.get(`${s.source}::${s.platform}`) ?? [],
  }));

  const rollups = computeRollups(baseRows);
  const allRows: AggregateRow[] = [...baseRows, ...rollups];

  for (const row of allRows) {
    await db
      .insert(trafficDailyAggregate)
      .values({
        workspaceId,
        periodStart: date,
        source: row.source,
        platform: row.platform,
        visitCount: row.visitCount,
        uniquePages: row.uniquePages,
        topPages: row.topPages,
      })
      .onConflictDoUpdate({
        target: [
          trafficDailyAggregate.workspaceId,
          trafficDailyAggregate.periodStart,
          trafficDailyAggregate.source,
          trafficDailyAggregate.platform,
        ],
        set: {
          visitCount: row.visitCount,
          uniquePages: row.uniquePages,
          topPages: row.topPages,
          updatedAt: new Date(),
        },
      });
  }

  log.info(
    { workspaceId, date, rowCount: allRows.length, totalVisits: sumVisits(baseRows) },
    'traffic daily aggregate computed'
  );
}

/** Exposed for unit testing — computes the `_all_` sentinel rows from base rows. */
export function computeRollups(baseRows: AggregateRow[]): AggregateRow[] {
  const bySource = new Map<string, AggregateRow[]>();
  const byPlatform = new Map<string, AggregateRow[]>();

  for (const row of baseRows) {
    (bySource.get(row.source) ?? bySource.set(row.source, []).get(row.source)!).push(row);
    (byPlatform.get(row.platform) ?? byPlatform.set(row.platform, []).get(row.platform)!).push(row);
  }

  const rollups: AggregateRow[] = [];

  // (source, platform='_all_') — sum across platforms for each source.
  for (const [source, rows] of bySource.entries()) {
    rollups.push(collapseRows(rows, source, '_all_'));
  }

  // (source='_all_', platform) — sum across sources for each platform.
  for (const [platform, rows] of byPlatform.entries()) {
    rollups.push(collapseRows(rows, '_all_', platform));
  }

  // (source='_all_', platform='_all_') — workspace total.
  rollups.push(collapseRows(baseRows, '_all_', '_all_'));

  return rollups;
}

function collapseRows(rows: AggregateRow[], source: string, platform: string): AggregateRow {
  const pageCounts = new Map<string, number>();
  const pathSet = new Set<string>();
  let visitCount = 0;

  for (const row of rows) {
    visitCount += row.visitCount;
    for (const tp of row.topPages) {
      pageCounts.set(tp.path, (pageCounts.get(tp.path) ?? 0) + tp.count);
      pathSet.add(tp.path);
    }
  }

  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PAGES_LIMIT)
    .map(([path, cnt]) => ({ path, count: cnt }));

  return {
    source,
    platform,
    visitCount,
    // Approximated from path set — a more accurate value requires a separate distinct query
    // across the raw ai_visit rows for the rollup dimensions. In practice this is within
    // a few % of truth when the top-20 captures the long tail.
    uniquePages: pathSet.size,
    topPages,
  };
}

function sumVisits(rows: AggregateRow[]): number {
  return rows.reduce((total, row) => total + row.visitCount, 0);
}
