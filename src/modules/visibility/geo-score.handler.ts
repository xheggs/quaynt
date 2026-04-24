import type { PgBoss } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { computeAndPersist, listActiveBrands } from './geo-score.service';
import { selectContributingPromptSets, lastCompletePeriod } from './geo-score.inputs';
import { FORMULA_VERSION } from './geo-score.formula';
import { geoScoreFormulaMigration, geoScoreSnapshot } from './geo-score-snapshot.schema';
import type { Granularity } from './geo-score.types';

export interface GeoScoreComputeJobData {
  workspaceId: string;
  brandId: string;
  periodStart: string;
  granularity: Granularity;
}

/**
 * Register all pg-boss handlers for the GEO Score feature:
 *  - `geo-score-compute` — ad-hoc per (workspace, brand, period, granularity)
 *  - `geo-score-snapshot-daily` — scheduled daily enumeration
 *  - `geo-score-backfill-version-{N}` — one-shot version-bump backfill
 */
export async function registerGeoScoreHandlers(boss: PgBoss): Promise<void> {
  await boss.work<GeoScoreComputeJobData>(
    'geo-score-compute',
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, brandId, periodStart, granularity } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, brandId, periodStart, granularity });

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
              'visibility.geo_score_computed',
              {
                geoScore: {
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
                  computedAt: result.computedAt,
                },
              },
              boss
            );
          } catch (err) {
            log.warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Failed to dispatch geo_score_computed webhook'
            );
          }

          // Alert evaluation — brand-scoped metric (promptSetId null)
          try {
            await boss.send(
              'alert-evaluate',
              {
                workspaceId,
                promptSetId: null,
                metric: 'geo_score',
                date: periodEnd,
              },
              {
                singletonKey: `alert:${workspaceId}:geo_score:${brandId}:${periodEnd}`,
                singletonSeconds: 120,
              }
            );
          } catch (err) {
            log.warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Failed to enqueue geo_score alert evaluation'
            );
          }

          log.info(
            { composite: result.composite, compositeRaw: result.compositeRaw },
            'GEO score compute complete'
          );
        } catch (err) {
          log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'GEO score compute failed'
          );
          throw err;
        }
      }
    }
  );

  // Daily scheduled snapshot: enumerate active brands and enqueue compute jobs
  await boss.schedule('geo-score-snapshot-daily', env.GEO_SCORE_SNAPSHOT_CRON, {});
  await boss.work(
    'geo-score-snapshot-daily',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: 'geo-score-snapshot-daily' });
      const now = new Date();

      const brands = await listActiveBrands();
      log.info({ brandCount: brands.length }, 'Enqueueing daily GEO score snapshots');

      let weeklyEnqueued = 0;
      let monthlyEnqueued = 0;

      for (const { workspaceId, brandId } of brands) {
        const contributing = await selectContributingPromptSets(workspaceId, brandId);
        if (contributing.length === 0) continue;

        for (const granularity of ['weekly', 'monthly'] as const) {
          const { periodStart } = lastCompletePeriod(now, granularity);
          try {
            await boss.send(
              'geo-score-compute',
              { workspaceId, brandId, periodStart, granularity },
              {
                singletonKey: `geo-score:${workspaceId}:${brandId}:${periodStart}:${granularity}`,
                singletonSeconds: 120,
              }
            );
            if (granularity === 'weekly') weeklyEnqueued++;
            else monthlyEnqueued++;
          } catch (err) {
            log.warn(
              {
                error: err instanceof Error ? err.message : String(err),
                workspaceId,
                brandId,
                granularity,
              },
              'Failed to enqueue GEO score compute'
            );
          }
        }
      }

      log.info({ weeklyEnqueued, monthlyEnqueued }, 'Daily GEO score enqueue complete');
    }
  );

  // Formula-version migration: one-shot backfill when a new version ships.
  await registerFormulaVersionBackfill(boss);
}

/**
 * On worker startup, enqueue a singleton backfill job for the current FORMULA_VERSION
 * if no geo_score_formula_migration row exists for it yet.
 */
async function registerFormulaVersionBackfill(boss: PgBoss): Promise<void> {
  const jobName = `geo-score-backfill-version-${FORMULA_VERSION}`;

  await boss.work(jobName, { includeMetadata: true, localConcurrency: 1 }, async () => {
    const log = logger.child({ job: jobName });
    try {
      // If already applied, no-op
      const existing = await db
        .select({ formulaVersion: geoScoreFormulaMigration.formulaVersion })
        .from(geoScoreFormulaMigration)
        .where(eq(geoScoreFormulaMigration.formulaVersion, FORMULA_VERSION))
        .limit(1);

      if (existing.length > 0) {
        log.info('Backfill already applied — skipping');
        return;
      }

      // If the snapshot table is empty (first deploy), just mark as applied
      const anySnapshot = await db
        .select({ id: geoScoreSnapshot.id })
        .from(geoScoreSnapshot)
        .limit(1);

      if (anySnapshot.length === 0) {
        await db
          .insert(geoScoreFormulaMigration)
          .values({ formulaVersion: FORMULA_VERSION })
          .onConflictDoNothing();
        log.info('No snapshots exist — migration row written without backfill');
        return;
      }

      // Enumerate 90-day window of brand/period combinations and recompute
      const brands = await listActiveBrands();
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - 90);

      let enqueued = 0;
      for (const { workspaceId, brandId } of brands) {
        const contributing = await selectContributingPromptSets(workspaceId, brandId);
        if (contributing.length === 0) continue;

        for (const granularity of ['weekly', 'monthly'] as const) {
          const { periodStart } = lastCompletePeriod(now, granularity);
          try {
            await boss.send(
              'geo-score-compute',
              { workspaceId, brandId, periodStart, granularity },
              {
                singletonKey: `geo-score-backfill:${workspaceId}:${brandId}:${periodStart}:${granularity}`,
                singletonSeconds: 600,
              }
            );
            enqueued++;
          } catch {
            // Best effort — singleton dedupes; continue
          }
        }
      }

      await db
        .insert(geoScoreFormulaMigration)
        .values({ formulaVersion: FORMULA_VERSION })
        .onConflictDoNothing();

      log.info({ enqueued }, 'Formula version backfill enqueue complete');
    } catch (err) {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        'Formula version backfill failed'
      );
      throw err;
    }
  });

  // Trigger the one-shot backfill job if no migration row exists yet.
  try {
    const existing = await db
      .select({ formulaVersion: geoScoreFormulaMigration.formulaVersion })
      .from(geoScoreFormulaMigration)
      .where(eq(geoScoreFormulaMigration.formulaVersion, FORMULA_VERSION))
      .limit(1);

    if (existing.length === 0) {
      await boss.send(
        jobName,
        {},
        {
          singletonKey: `geo-score-backfill-trigger:${FORMULA_VERSION}`,
          singletonSeconds: 3600,
        }
      );
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to evaluate GEO formula version migration'
    );
  }
}

/** Derive periodEnd from periodStart for a given granularity. */
function derivePeriodEnd(periodStart: string, granularity: Granularity): string {
  const d = new Date(periodStart + 'T00:00:00Z');
  if (granularity === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 6);
  } else {
    // Last day of the same month
    const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return nextMonth.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}
