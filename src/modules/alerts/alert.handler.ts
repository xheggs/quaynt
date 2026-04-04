import type { PgBoss } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { alertRule } from './alert.schema';
import { evaluateRulesForMetric } from './alert.evaluator';
import type { AlertEvaluateJobData, AlertMetric } from './alert.types';

const ALERT_METRICS: AlertMetric[] = [
  'recommendation_share',
  'citation_count',
  'sentiment_score',
  'position_average',
];

export async function registerAlertHandlers(boss: PgBoss): Promise<void> {
  // Evaluate alerts for a specific workspace + promptSet + metric + date
  await boss.work<AlertEvaluateJobData>(
    'alert-evaluate',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, metric, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, metric, date });

        try {
          log.info('Evaluating alert rules');
          const results = await evaluateRulesForMetric(
            workspaceId,
            promptSetId,
            metric,
            date,
            boss
          );

          const triggered = results.filter((r) => r.reason === 'triggered').length;
          const skipped = results.filter((r) => r.reason === 'cooldown_active').length;
          log.info({ total: results.length, triggered, skipped }, 'Alert evaluation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Alert evaluation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — evaluate all enabled rules for yesterday
  await boss.work(
    'alert-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'alert-daily-reconcile' });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      try {
        // Find all distinct workspace/promptSet combos with enabled rules
        const pairs = await db
          .selectDistinct({
            workspaceId: alertRule.workspaceId,
            promptSetId: alertRule.promptSetId,
          })
          .from(alertRule)
          .where(eq(alertRule.enabled, true));

        log.info({ pairCount: pairs.length, date: yesterdayStr }, 'Reconciling alert rules');

        for (const pair of pairs) {
          for (const metric of ALERT_METRICS) {
            await boss.send(
              'alert-evaluate',
              {
                workspaceId: pair.workspaceId,
                promptSetId: pair.promptSetId,
                metric,
                date: yesterdayStr,
              },
              {
                singletonKey: `alert:${pair.workspaceId}:${metric}:${yesterdayStr}`,
                singletonSeconds: 120,
              }
            );
          }
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Alert reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 07:00 UTC
  await boss.schedule('alert-daily-reconcile', '0 7 * * *', {});
}
