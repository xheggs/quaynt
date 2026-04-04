import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeOpportunities } from './opportunity.compute';
import type { OpportunityComputeJobData } from './opportunity.types';

export async function registerOpportunityHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+promptSet after recommendation share computation
  await boss.work<OpportunityComputeJobData>(
    'opportunity-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, date });

        try {
          log.info('Computing opportunities');
          const { changed, opportunityCount } = await computeOpportunities({
            workspaceId,
            promptSetId,
            date,
          });

          if (changed) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.opportunities_updated',
                {
                  opportunities: {
                    workspaceId,
                    promptSetId,
                    date,
                    totalOpportunities: opportunityCount,
                  },
                },
                boss
              );
            } catch (err) {
              log.warn(
                { error: err instanceof Error ? err.message : String(err) },
                'Failed to dispatch opportunities webhook'
              );
            }
          }

          log.info({ changed, opportunityCount }, 'Opportunity computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Opportunity computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recomputes yesterday's opportunities for all active workspace/promptSet combos
  await boss.work(
    'opportunity-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'opportunity-daily-reconcile' });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const dayStart = new Date(`${yesterdayStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${yesterdayStr}T23:59:59.999Z`);

      try {
        const pairs = await db
          .selectDistinct({
            workspaceId: citation.workspaceId,
            promptSetId: modelRun.promptSetId,
          })
          .from(citation)
          .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
          .where(and(gte(citation.createdAt, dayStart), lt(citation.createdAt, dayEnd)));

        log.info({ pairCount: pairs.length, date: yesterdayStr }, 'Reconciling opportunities');

        for (const pair of pairs) {
          await boss.send('opportunity-compute', {
            workspaceId: pair.workspaceId,
            promptSetId: pair.promptSetId,
            date: yesterdayStr,
          });
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Opportunity reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 05:00 UTC
  await boss.schedule('opportunity-daily-reconcile', '0 5 * * *', {});
}
