import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeRecommendationShare } from './recommendation-share.compute';
import type { RecommendationShareComputeJobData } from './recommendation-share.types';

export async function registerVisibilityHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+promptSet after citation extraction
  await boss.work<RecommendationShareComputeJobData>(
    'recommendation-share-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, date });

        try {
          log.info('Computing recommendation share');
          const { changed } = await computeRecommendationShare({ workspaceId, promptSetId, date });

          if (changed) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.recommendation_share_updated',
                {
                  recommendationShare: {
                    workspaceId,
                    promptSetId,
                    date,
                  },
                },
                boss
              );
            } catch (err) {
              log.warn(
                { error: err instanceof Error ? err.message : String(err) },
                'Failed to dispatch recommendation share webhook'
              );
            }
          }

          // Chain opportunity compute after recommendation share
          try {
            await boss.send(
              'opportunity-compute',
              {
                workspaceId,
                promptSetId,
                date,
              },
              {
                singletonKey: `opportunity:${workspaceId}:${promptSetId}:${date}`,
                singletonSeconds: 120,
              }
            );
          } catch (enqueueErr) {
            log.warn(
              { error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr) },
              'Failed to enqueue opportunity compute job'
            );
          }

          // Chain alert evaluation for recommendation_share and citation_count metrics
          for (const metric of ['recommendation_share', 'citation_count'] as const) {
            try {
              await boss.send(
                'alert-evaluate',
                {
                  workspaceId,
                  promptSetId,
                  metric,
                  date,
                },
                {
                  singletonKey: `alert:${workspaceId}:${metric}:${date}`,
                  singletonSeconds: 120,
                }
              );
            } catch (enqueueErr) {
              log.warn(
                {
                  error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
                  metric,
                },
                'Failed to enqueue alert evaluation job'
              );
            }
          }

          log.info({ changed }, 'Recommendation share computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Recommendation share computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recomputes yesterday's shares for all active workspace/promptSet combos
  await boss.work(
    'recommendation-share-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'recommendation-share-daily-reconcile' });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const dayStart = new Date(`${yesterdayStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${yesterdayStr}T23:59:59.999Z`);

      try {
        // Find all distinct workspace/promptSet combos from yesterday's citations
        const pairs = await db
          .selectDistinct({
            workspaceId: citation.workspaceId,
            promptSetId: modelRun.promptSetId,
          })
          .from(citation)
          .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
          .where(and(gte(citation.createdAt, dayStart), lt(citation.createdAt, dayEnd)));

        log.info(
          { pairCount: pairs.length, date: yesterdayStr },
          'Reconciling recommendation shares'
        );

        for (const pair of pairs) {
          await boss.send('recommendation-share-compute', {
            workspaceId: pair.workspaceId,
            promptSetId: pair.promptSetId,
            date: yesterdayStr,
          });
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Recommendation share reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 01:00 UTC
  await boss.schedule('recommendation-share-daily-reconcile', '0 1 * * *', {});
}
