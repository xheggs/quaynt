import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import { db } from '@/lib/db';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { computeDailyAggregate } from './traffic-aggregate.compute';
import { purgeOldVisits } from './ai-visit.service';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { aiVisit } from './ai-visit.schema';
import { trafficDailyAggregate } from './traffic-aggregate.schema';
import type { TrafficAggregateJobData, TrafficDailySummaryWebhook } from './traffic.types';

export async function registerTrafficHandlers(boss: PgBoss): Promise<void> {
  // Aggregate handler — compute daily rollups for a workspace + date.
  await boss.work<TrafficAggregateJobData>(
    'traffic-aggregate',
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, date });

        log.info('computing traffic daily aggregate');

        try {
          await computeDailyAggregate(workspaceId, date);

          // Chain the alert evaluator for traffic metrics.
          await boss.send('alert-evaluate', {
            workspaceId,
            promptSetId: null,
            metric: 'ai_visit_count',
            date,
          });
          await boss.send('alert-evaluate', {
            workspaceId,
            promptSetId: null,
            metric: 'ai_visit_platform_drop',
            date,
          });

          // Emit the daily summary webhook.
          await emitDailySummary(workspaceId, date, boss);
        } catch (err) {
          log.error({ err }, 'traffic aggregate computation failed');
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recompute yesterday's aggregates at 03:00 UTC to cover late
  // arrivals, failed jobs, or edge-cases at midnight.
  await boss.schedule('traffic-daily-reconcile', '0 3 * * *', {});
  await boss.work(
    'traffic-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'traffic-daily-reconcile' });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().slice(0, 10);

      log.info({ date: dateStr }, 'running traffic daily reconciliation');

      // Find every workspace with visits yesterday; schedule an aggregate job each.
      const dayStart = new Date(`${dateStr}T00:00:00Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
      const rows = await db
        .selectDistinct({ workspaceId: aiVisit.workspaceId })
        .from(aiVisit)
        .where(and(gte(aiVisit.visitedAt, dayStart), lt(aiVisit.visitedAt, dayEnd)));

      for (const row of rows) {
        await boss.send(
          'traffic-aggregate',
          { workspaceId: row.workspaceId, date: dateStr },
          {
            singletonKey: `traffic-agg:${row.workspaceId}:${dateStr}`,
            singletonSeconds: 120,
          }
        );
      }
      log.info({ workspaceCount: rows.length }, 'reconciliation scheduled');
    }
  );

  // Weekly retention cleanup — purge raw visits older than the configured retention.
  await boss.schedule('traffic-retention-cleanup', '0 4 * * 0', {});
  await boss.work(
    'traffic-retention-cleanup',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'traffic-retention-cleanup' });
      const retentionDays = env.TRAFFIC_VISIT_RETENTION_DAYS;
      log.info({ retentionDays }, 'purging old AI visits');
      await purgeOldVisits(retentionDays);
    }
  );
}

async function emitDailySummary(workspaceId: string, date: string, boss: PgBoss): Promise<void> {
  // Pull the `_all_` rollup across sources for the total, plus the per-platform slice
  // (source='_all_', platform != '_all_') for the byPlatform breakdown.
  const rows = await db
    .select({
      platform: trafficDailyAggregate.platform,
      visits: trafficDailyAggregate.visitCount,
    })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.periodStart, date),
        eq(trafficDailyAggregate.source, '_all_'),
        sql`${trafficDailyAggregate.platform} != '_all_'`
      )
    );

  const byPlatform: Record<string, number> = {};
  let totalVisits = 0;
  for (const row of rows) {
    byPlatform[row.platform] = row.visits;
    totalVisits += row.visits;
  }

  const payload: TrafficDailySummaryWebhook = {
    date,
    totalVisits,
    byPlatform,
    source: 'all',
  };

  await dispatchWebhookEvent(workspaceId, 'traffic.daily_summary', payload, boss);
}
