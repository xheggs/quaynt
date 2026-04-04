import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeSentimentAggregate } from './sentiment-aggregate.compute';
import type { SentimentAggregateComputeInput } from './sentiment-aggregate.types';

export async function registerSentimentAggregateHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+promptSet after citation extraction
  await boss.work<SentimentAggregateComputeInput>(
    'sentiment-aggregate-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, date });

        try {
          log.info('Computing sentiment aggregate');
          const { changed } = await computeSentimentAggregate({ workspaceId, promptSetId, date });

          if (changed) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.sentiment_aggregate_updated',
                {
                  sentimentAggregate: {
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
                'Failed to dispatch sentiment aggregate webhook'
              );
            }
          }

          // Chain alert evaluation for sentiment_score metric
          try {
            await boss.send(
              'alert-evaluate',
              {
                workspaceId,
                promptSetId,
                metric: 'sentiment_score',
                date,
              },
              {
                singletonKey: `alert:${workspaceId}:sentiment_score:${date}`,
                singletonSeconds: 120,
              }
            );
          } catch (enqueueErr) {
            log.warn(
              { error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr) },
              'Failed to enqueue alert evaluation job'
            );
          }

          log.info({ changed }, 'Sentiment aggregate computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Sentiment aggregate computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recomputes yesterday's sentiment for all active workspace/promptSet combos
  await boss.work(
    'sentiment-aggregate-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'sentiment-aggregate-daily-reconcile' });

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
          .where(
            and(
              gte(citation.createdAt, dayStart),
              lt(citation.createdAt, dayEnd),
              isNotNull(citation.sentimentLabel)
            )
          );

        log.info(
          { pairCount: pairs.length, date: yesterdayStr },
          'Reconciling sentiment aggregates'
        );

        for (const pair of pairs) {
          await boss.send('sentiment-aggregate-compute', {
            workspaceId: pair.workspaceId,
            promptSetId: pair.promptSetId,
            date: yesterdayStr,
          });
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Sentiment aggregate reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 02:00 UTC (1 hour after recommendation share)
  await boss.schedule('sentiment-aggregate-daily-reconcile', '0 2 * * *', {});
}
