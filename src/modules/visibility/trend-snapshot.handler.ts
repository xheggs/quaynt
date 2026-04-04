import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeTrendSnapshots } from './trend-snapshot.compute';
import type { TrendMetric, TrendPeriod } from './trend.types';

interface TrendSnapshotComputeJobData {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  metric: TrendMetric;
  period: TrendPeriod;
}

const ALL_METRICS: TrendMetric[] = [
  'recommendation_share',
  'sentiment',
  'average_position',
  'first_mention_rate',
  'citation_count',
  'opportunity_count',
];

const ALL_PERIODS: TrendPeriod[] = ['weekly', 'monthly'];

export async function registerTrendSnapshotHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+brand+metric+period
  await boss.work<TrendSnapshotComputeJobData>(
    'trend-snapshot-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, brandId, metric, period } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, brandId, metric, period });

        try {
          log.info('Computing trend snapshot');
          const { changed, anomalyCount } = await computeTrendSnapshots({
            workspaceId,
            promptSetId,
            brandId,
            metric,
            period,
          });

          if (anomalyCount > 0) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.trend_anomaly_detected',
                {
                  trendAnomaly: {
                    workspaceId,
                    brandId,
                    promptSetId,
                    metric,
                    period,
                    anomalyCount,
                  },
                },
                boss
              );
            } catch (err) {
              log.warn(
                { error: err instanceof Error ? err.message : String(err) },
                'Failed to dispatch trend anomaly webhook'
              );
            }
          }

          log.info({ changed, anomalyCount }, 'Trend snapshot computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Trend snapshot computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — enqueues compute jobs for all active workspace/brand/metric combos
  await boss.work(
    'trend-snapshot-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'trend-snapshot-daily-reconcile' });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const dayStart = new Date(`${yesterdayStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${yesterdayStr}T23:59:59.999Z`);

      try {
        // Find all distinct workspace/promptSet/brand combos from yesterday's citations
        const triples = await db
          .selectDistinct({
            workspaceId: citation.workspaceId,
            promptSetId: modelRun.promptSetId,
            brandId: citation.brandId,
          })
          .from(citation)
          .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
          .where(and(gte(citation.createdAt, dayStart), lt(citation.createdAt, dayEnd)));

        log.info(
          { tripleCount: triples.length, date: yesterdayStr },
          'Reconciling trend snapshots'
        );

        for (const triple of triples) {
          for (const metric of ALL_METRICS) {
            for (const period of ALL_PERIODS) {
              await boss.send(
                'trend-snapshot-compute',
                {
                  workspaceId: triple.workspaceId,
                  promptSetId: triple.promptSetId,
                  brandId: triple.brandId,
                  metric,
                  period,
                },
                {
                  singletonKey: `trend-snapshot:${triple.workspaceId}:${triple.promptSetId}:${triple.brandId}:${metric}:${period}`,
                  singletonSeconds: 120,
                }
              );
            }
          }
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Trend snapshot reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 06:00 UTC
  await boss.schedule('trend-snapshot-daily-reconcile', '0 6 * * *', {});
}
