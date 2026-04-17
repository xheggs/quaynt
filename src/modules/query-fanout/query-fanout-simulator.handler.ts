import type { PgBoss } from 'pg-boss';
import { and, isNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { queryFanoutSimulationCache } from './query-fanout-simulation-cache.schema';

const CLEANUP_JOB_NAME = 'query-fanout-simulation-cache-cleanup';

/**
 * Prune stale simulation-cache rows.
 *
 * A row is stale when it was generated more than `CACHE_TTL_DAYS` ago AND has
 * never been re-hit (`lastHitAt IS NULL`). Hot rows (any positive hit count)
 * stay forever — the cache is the primary cost lever and dropping frequently
 * reused rows defeats the point.
 */
export async function purgeExpiredSimulationCache(ttlDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(queryFanoutSimulationCache)
    .where(
      and(
        lt(queryFanoutSimulationCache.generatedAt, cutoff),
        isNull(queryFanoutSimulationCache.lastHitAt)
      )
    )
    .returning({ id: queryFanoutSimulationCache.id });
  return deleted.length;
}

/**
 * Register the weekly simulation-cache cleanup job.
 *
 * Schedule: Sundays at 05:00 UTC (offset from other Sunday-morning jobs so we
 * don't stack).
 */
export async function registerQueryFanoutSimulatorHandlers(boss: PgBoss): Promise<void> {
  await boss.schedule(CLEANUP_JOB_NAME, '0 5 * * 0', {});
  await boss.work(CLEANUP_JOB_NAME, { includeMetadata: true, localConcurrency: 1 }, async () => {
    const ttlDays = env.QUERY_FANOUT_SIMULATION_CACHE_TTL_DAYS;
    const log = logger.child({ job: CLEANUP_JOB_NAME });
    log.info({ ttlDays }, 'Running simulation cache cleanup');
    const removed = await purgeExpiredSimulationCache(ttlDays);
    log.info({ removed }, 'Simulation cache cleanup complete');
  });
}
