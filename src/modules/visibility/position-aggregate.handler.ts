import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computePositionAggregate } from './position-aggregate.compute';
import type { PositionAggregateComputeInput } from './position-aggregate.types';

export async function registerPositionAggregateHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+promptSet after citation extraction
  await boss.work<PositionAggregateComputeInput>(
    'position-aggregate-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, date });

        try {
          log.info('Computing position aggregate');
          const { changed } = await computePositionAggregate({ workspaceId, promptSetId, date });

          if (changed) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.position_aggregate_updated',
                {
                  positionAggregate: {
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
                'Failed to dispatch position aggregate webhook'
              );
            }
          }

          // Chain alert evaluation for position_average metric
          try {
            await boss.send(
              'alert-evaluate',
              {
                workspaceId,
                promptSetId,
                metric: 'position_average',
                date,
              },
              {
                singletonKey: `alert:${workspaceId}:position_average:${date}`,
                singletonSeconds: 120,
              }
            );
          } catch (enqueueErr) {
            log.warn(
              { error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr) },
              'Failed to enqueue alert evaluation job'
            );
          }

          log.info({ changed }, 'Position aggregate computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Position aggregate computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recomputes yesterday's positions for all active workspace/promptSet combos
  await boss.work(
    'position-aggregate-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'position-aggregate-daily-reconcile' });

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

        log.info(
          { pairCount: pairs.length, date: yesterdayStr },
          'Reconciling position aggregates'
        );

        for (const pair of pairs) {
          await boss.send('position-aggregate-compute', {
            workspaceId: pair.workspaceId,
            promptSetId: pair.promptSetId,
            date: yesterdayStr,
          });
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Position aggregate reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 04:00 UTC (after rec share 01:00, sentiment 02:00, sources 03:00)
  await boss.schedule('position-aggregate-daily-reconcile', '0 4 * * *', {});
}
