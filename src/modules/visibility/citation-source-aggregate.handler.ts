import type { PgBoss } from 'pg-boss';
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeCitationSourceAggregate } from './citation-source-aggregate.compute';
import type { CitationSourceComputeInput } from './citation-source-aggregate.types';

export async function registerCitationSourceHandlers(boss: PgBoss): Promise<void> {
  // Compute handler — triggered per workspace+promptSet after citation extraction
  await boss.work<CitationSourceComputeInput>(
    'citation-source-compute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, promptSetId, date } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, promptSetId, date });

        try {
          log.info('Computing citation source aggregate');
          const { changed } = await computeCitationSourceAggregate({
            workspaceId,
            promptSetId,
            date,
          });

          if (changed) {
            try {
              await dispatchWebhookEvent(
                workspaceId,
                'visibility.citation_sources_updated',
                {
                  citationSources: {
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
                'Failed to dispatch citation source aggregate webhook'
              );
            }
          }

          log.info({ changed }, 'Citation source aggregate computation complete');
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Citation source aggregate computation failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily reconciliation — recomputes yesterday's source aggregates for all active workspace/promptSet combos
  await boss.work(
    'citation-source-daily-reconcile',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'citation-source-daily-reconcile' });

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
              isNotNull(citation.domain)
            )
          );

        log.info(
          { pairCount: pairs.length, date: yesterdayStr },
          'Reconciling citation source aggregates'
        );

        for (const pair of pairs) {
          await boss.send('citation-source-compute', {
            workspaceId: pair.workspaceId,
            promptSetId: pair.promptSetId,
            date: yesterdayStr,
          });
        }
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Citation source aggregate reconciliation failed'
        );
        throw err;
      }
    }
  );

  // Schedule daily reconciliation at 03:00 UTC (after rec share at 01:00 and sentiment at 02:00)
  await boss.schedule('citation-source-daily-reconcile', '0 3 * * *', {});
}
