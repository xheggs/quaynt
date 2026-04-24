import type { PgBoss } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeAndPersist, listActiveBrandsWithGsc } from './seo-score.service';
import { derivePeriodEnd, lastCompletePeriod } from './seo-score.inputs';
import { FORMULA_VERSION } from './seo-score.formula';
import { seoScoreFormulaMigration, seoScoreSnapshot } from './seo-score-snapshot.schema';
import type { Granularity } from './seo-score.types';

export interface SeoScoreComputeJobData {
  workspaceId: string;
  brandId: string;
  periodStart: string;
  granularity: Granularity;
}

/**
 * Register all pg-boss handlers for the SEO Score feature:
 *  - `seo-score-compute` — ad-hoc per (workspace, brand, period, granularity)
 *  - `seo-score-snapshot-daily` — scheduled daily enumeration
 *  - `seo-score-backfill-version-{N}` — one-shot version-bump backfill
 */
export async function registerSeoScoreHandlers(boss: PgBoss): Promise<void> {
  await boss.work<SeoScoreComputeJobData>(
    'seo-score-compute',
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, brandId, periodStart, granularity } = job.data;
        const log = logger.child({
          jobId: job.id,
          workspaceId,
          brandId,
          periodStart,
          granularity,
        });

        try {
          const periodEnd = derivePeriodEnd(periodStart, granularity);
          const result = await computeAndPersist(
            workspaceId,
            brandId,
            periodStart,
            periodEnd,
            granularity
          );

          // Webhook
          try {
            await dispatchWebhookEvent(
              workspaceId,
              'visibility.seo_score_computed',
              {
                seoScore: {
                  brandId,
                  periodStart,
                  periodEnd,
                  granularity,
                  composite: result.composite,
                  compositeRaw: result.compositeRaw,
                  displayCapApplied: result.displayCapApplied,
                  formulaVersion: result.formulaVersion,
                  factors: result.factors,
                  contributingPromptSetIds: result.contributingPromptSetIds,
                  querySetSize: result.querySetSize,
                  dataQualityAdvisories: result.dataQualityAdvisories,
                  code: result.code ?? null,
                  computedAt: result.computedAt,
                },
              },
              boss
            );
          } catch (err) {
            log.warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Failed to dispatch seo_score_computed webhook'
            );
          }

          // Alert evaluation — brand-scoped metric (promptSetId null)
          try {
            await boss.send(
              'alert-evaluate',
              {
                workspaceId,
                promptSetId: null,
                metric: 'seo_score',
                date: periodEnd,
              },
              {
                singletonKey: `alert:${workspaceId}:seo_score:${brandId}:${periodEnd}`,
                singletonSeconds: 120,
              }
            );
          } catch (err) {
            log.warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Failed to enqueue seo_score alert evaluation'
            );
          }

          log.info(
            {
              composite: result.composite,
              compositeRaw: result.compositeRaw,
              code: result.code ?? null,
            },
            'SEO score compute complete'
          );
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'SEO score compute failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily scheduled snapshot — enumerate brands with an active GSC connection
  // and enqueue compute jobs. Runs at 07:00 UTC by default (after gsc-daily-sync
  // at 06:00 UTC) so snapshots see fresh GSC data.
  await boss.schedule('seo-score-snapshot-daily', env.SEO_SCORE_SNAPSHOT_CRON, {});
  await boss.work(
    'seo-score-snapshot-daily',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'seo-score-snapshot-daily' });
      const now = new Date();

      const brands = await listActiveBrandsWithGsc();
      log.info({ brandCount: brands.length }, 'Enqueueing daily SEO score snapshots');

      let weeklyEnqueued = 0;
      let monthlyEnqueued = 0;

      for (const { workspaceId, brandId } of brands) {
        for (const granularity of ['weekly', 'monthly'] as const) {
          const { periodStart } = lastCompletePeriod(now, granularity);
          try {
            await boss.send(
              'seo-score-compute',
              { workspaceId, brandId, periodStart, granularity },
              {
                singletonKey: `seo-score:${workspaceId}:${brandId}:${periodStart}:${granularity}`,
                singletonSeconds: 120,
              }
            );
            if (granularity === 'weekly') weeklyEnqueued += 1;
            else monthlyEnqueued += 1;
          } catch (err) {
            log.warn(
              {
                error: err instanceof Error ? err.message : String(err),
                workspaceId,
                brandId,
                granularity,
              },
              'Failed to enqueue SEO score compute'
            );
          }
        }
      }

      log.info({ weeklyEnqueued, monthlyEnqueued }, 'Daily SEO score enqueue complete');
    }
  );

  // Formula-version migration — one-shot backfill when a new version ships.
  await registerFormulaVersionBackfill(boss);
}

/**
 * On worker startup, enqueue a singleton backfill job for the current
 * FORMULA_VERSION if no seo_score_formula_migration row exists for it yet.
 */
async function registerFormulaVersionBackfill(boss: PgBoss): Promise<void> {
  const jobName = `seo-score-backfill-version-${FORMULA_VERSION}`;

  await boss.work(jobName, { includeMetadata: true, localConcurrency: 1 }, async () => {
    const log = logger.child({ job: jobName });
    try {
      const existing = await db
        .select({ formulaVersion: seoScoreFormulaMigration.formulaVersion })
        .from(seoScoreFormulaMigration)
        .where(eq(seoScoreFormulaMigration.formulaVersion, FORMULA_VERSION))
        .limit(1);

      if (existing.length > 0) {
        log.info('Backfill already applied — skipping');
        return;
      }

      const anySnapshot = await db
        .select({ id: seoScoreSnapshot.id })
        .from(seoScoreSnapshot)
        .limit(1);

      if (anySnapshot.length === 0) {
        await db
          .insert(seoScoreFormulaMigration)
          .values({ formulaVersion: FORMULA_VERSION })
          .onConflictDoNothing();
        log.info('No snapshots exist — migration row written without backfill');
        return;
      }

      const brands = await listActiveBrandsWithGsc();
      const now = new Date();

      let enqueued = 0;
      for (const { workspaceId, brandId } of brands) {
        for (const granularity of ['weekly', 'monthly'] as const) {
          const { periodStart } = lastCompletePeriod(now, granularity);
          try {
            await boss.send(
              'seo-score-compute',
              { workspaceId, brandId, periodStart, granularity },
              {
                singletonKey: `seo-score-backfill:${workspaceId}:${brandId}:${periodStart}:${granularity}`,
                singletonSeconds: 600,
              }
            );
            enqueued += 1;
          } catch {
            // Best-effort — singleton dedupes; continue.
          }
        }
      }

      await db
        .insert(seoScoreFormulaMigration)
        .values({ formulaVersion: FORMULA_VERSION })
        .onConflictDoNothing();

      log.info({ enqueued }, 'SEO formula version backfill enqueue complete');
    } catch (err) {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        'SEO formula version backfill failed'
      );
      throw err;
    }
  });

  try {
    const existing = await db
      .select({ formulaVersion: seoScoreFormulaMigration.formulaVersion })
      .from(seoScoreFormulaMigration)
      .where(eq(seoScoreFormulaMigration.formulaVersion, FORMULA_VERSION))
      .limit(1);

    if (existing.length === 0) {
      await boss.send(
        jobName,
        {},
        {
          singletonKey: `seo-score-backfill-trigger:${FORMULA_VERSION}`,
          singletonSeconds: 3600,
        }
      );
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to evaluate SEO formula version migration'
    );
  }
}
