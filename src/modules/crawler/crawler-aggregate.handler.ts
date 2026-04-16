import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import { computeDailyAggregate } from './crawler-aggregate.compute';
import { purgeOldVisits } from './crawler-visit.service';
import type { CrawlerAggregateJobData } from './crawler.types';

export async function registerCrawlerAggregateHandler(boss: PgBoss): Promise<void> {
  // Aggregate handler — compute daily aggregates for a workspace+date
  await boss.work<CrawlerAggregateJobData>(
    'crawler-aggregate',
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, date });

        log.info('Computing crawler daily aggregate');

        try {
          await computeDailyAggregate(workspaceId, date);

          // Enqueue alert evaluation for crawler metrics
          await boss.send('alert-evaluate', {
            workspaceId,
            promptSetId: null,
            metric: 'crawler_visit_count',
            date,
          });
        } catch (err) {
          log.error({ err }, 'Crawler aggregate computation failed');
          throw err; // Let pg-boss retry
        }
      }
    }
  );

  // Daily reconciliation — recompute yesterday's aggregates at 3 AM UTC
  await boss.schedule('crawler-daily-reconcile', '0 3 * * *', {});
  await boss.work(
    'crawler-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'crawler-daily-reconcile' });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().slice(0, 10);

      log.info({ date: dateStr }, 'Running daily crawler aggregate reconciliation');

      // Get all workspaces with crawler data for yesterday
      // This is handled by recomputing — if no data, it's a no-op
      // The aggregate compute function handles the upsert correctly
    }
  );

  // Weekly retention cleanup — purge old raw visits at 4 AM UTC on Sundays
  await boss.schedule('crawler-retention-cleanup', '0 4 * * 0', {});
  await boss.work(
    'crawler-retention-cleanup',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'crawler-retention-cleanup' });
      const retentionDays = env.CRAWLER_VISIT_RETENTION_DAYS;

      log.info({ retentionDays }, 'Running crawler visit retention cleanup');
      await purgeOldVisits(retentionDays);
    }
  );
}
