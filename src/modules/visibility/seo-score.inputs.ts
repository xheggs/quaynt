/**
 * Collects the raw inputs for one brand's SEO Score from Google Search Console
 * data joined to the brand's prompt-derived query set.
 *
 * Reads only; no side effects. Fails closed via explicit `SeoScoreCode` values
 * when the prerequisites (GSC connection, prompt sets, query set) are missing.
 */

import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { gscConnection } from '@/modules/integrations/gsc/gsc-connection.schema';
import { gscQueryPerformance } from '@/modules/integrations/gsc-correlation/gsc-query-performance.schema';
import {
  lowerTrimGscQuery,
  lowerTrimInterpolatedPrompt,
  selectBrandQuerySet,
} from '@/modules/integrations/gsc-correlation/query-set';
import type { Granularity, SeoFactorInputs, SeoScoreInputs } from './seo-score.types';

const AIO_PLATFORM_ID = 'aio';

/** Return the first active GSC connection for the workspace, or null. */
export async function getActiveGscConnectionId(workspaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: gscConnection.id })
    .from(gscConnection)
    .where(and(eq(gscConnection.workspaceId, workspaceId), eq(gscConnection.status, 'active')))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Aggregate GSC impressions/CTR/position across the brand's query set within
 * the period. Impression-weighted means: Σ(v × impressions) / Σ(impressions).
 */
export async function getGscAggregates(
  workspaceId: string,
  querySet: string[],
  periodStart: string,
  periodEnd: string
): Promise<{
  totalImpressions: number;
  impressionWeightedCtr: number | null;
  impressionWeightedPosition: number | null;
}> {
  if (querySet.length === 0) {
    return {
      totalImpressions: 0,
      impressionWeightedCtr: null,
      impressionWeightedPosition: null,
    };
  }

  const [agg] = await db
    .select({
      totalImpressions: sql<number>`coalesce(sum(${gscQueryPerformance.impressions}), 0)`,
      ctrNumerator: sql<number>`coalesce(sum(${gscQueryPerformance.ctr} * ${gscQueryPerformance.impressions}), 0)`,
      positionNumerator: sql<number>`coalesce(sum(${gscQueryPerformance.position} * ${gscQueryPerformance.impressions}), 0)`,
    })
    .from(gscQueryPerformance)
    .where(
      and(
        eq(gscQueryPerformance.workspaceId, workspaceId),
        gte(gscQueryPerformance.date, periodStart),
        lte(gscQueryPerformance.date, periodEnd),
        inArray(lowerTrimGscQuery, querySet)
      )
    );

  const totalImpressions = Number(agg?.totalImpressions ?? 0);
  if (totalImpressions <= 0) {
    return {
      totalImpressions: 0,
      impressionWeightedCtr: null,
      impressionWeightedPosition: null,
    };
  }

  return {
    totalImpressions,
    impressionWeightedCtr: Number(agg.ctrNumerator) / totalImpressions,
    impressionWeightedPosition: Number(agg.positionNumerator) / totalImpressions,
  };
}

/**
 * Count distinct (date, query) pairs in the period where the workspace had an
 * AIO citation and the underlying prompt text (lowercased+trimmed) is in the
 * brand's query set. Distinct on (date, query) avoids double-counting when
 * multiple citations land on the same date/query pair.
 */
export async function getAioMatchedCount(
  workspaceId: string,
  querySet: string[],
  periodStart: string,
  periodEnd: string
): Promise<number> {
  if (querySet.length === 0) return 0;

  const [row] = await db
    .select({
      count: sql<number>`count(distinct (date_trunc('day', ${citation.createdAt}), ${lowerTrimInterpolatedPrompt}))::int`,
    })
    .from(citation)
    .innerJoin(modelRunResult, eq(modelRunResult.id, citation.modelRunResultId))
    .where(
      and(
        eq(citation.workspaceId, workspaceId),
        eq(citation.platformId, AIO_PLATFORM_ID),
        gte(citation.createdAt, new Date(`${periodStart}T00:00:00.000Z`)),
        lte(citation.createdAt, new Date(`${periodEnd}T23:59:59.999Z`)),
        inArray(lowerTrimInterpolatedPrompt, querySet)
      )
    );

  return Number(row?.count ?? 0);
}

// --- Per-factor helpers (exposed for unit testing) ---

export async function getImpressionVolumeInput(
  impressions: number,
  querySetSize: number
): Promise<SeoFactorInputs['impression_volume']> {
  if (querySetSize === 0) return null;
  return { impressions, querySetSize };
}

export async function getCtrInput(agg: {
  totalImpressions: number;
  impressionWeightedCtr: number | null;
}): Promise<SeoFactorInputs['click_through_rate']> {
  if (agg.totalImpressions <= 0) {
    return { impressionWeightedCtr: null, totalImpressions: 0 };
  }
  return {
    impressionWeightedCtr: agg.impressionWeightedCtr,
    totalImpressions: agg.totalImpressions,
  };
}

export async function getRankQualityInput(agg: {
  totalImpressions: number;
  impressionWeightedPosition: number | null;
}): Promise<SeoFactorInputs['rank_quality']> {
  if (agg.totalImpressions <= 0) {
    return { impressionWeightedPosition: null, totalImpressions: 0 };
  }
  return {
    impressionWeightedPosition: agg.impressionWeightedPosition,
    totalImpressions: agg.totalImpressions,
  };
}

export async function getAioPresenceInput(
  aioMatchedCount: number,
  querySetSize: number
): Promise<SeoFactorInputs['aio_presence']> {
  if (querySetSize === 0) return null;
  return { aioMatchedCount, querySetSize };
}

// --- Main orchestrator ---

export interface CollectSeoInputsOptions {
  /** Override the contributing prompt sets / query set (for testing). */
  querySet?: string[];
  /** Override the contributing prompt set IDs (for testing). */
  contributingPromptSetIds?: string[];
}

/**
 * Collect all SEO factor inputs for one brand over one period.
 *
 * Early-exits with an `SeoScoreCode` when prerequisites are missing. The order
 * is load-bearing: connection → prompt sets → query set. Callers should persist
 * the returned code verbatim on the snapshot so operators can diagnose empty
 * states without re-running the pipeline.
 */
export async function collectInputs(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity,
  opts?: CollectSeoInputsOptions
): Promise<SeoScoreInputs> {
  const emptyFactors: SeoFactorInputs = {
    impression_volume: null,
    click_through_rate: null,
    rank_quality: null,
    aio_presence: null,
  };

  // 1. Active GSC connection?
  const gscConnectionId = await getActiveGscConnectionId(workspaceId);
  if (!gscConnectionId) {
    return {
      workspaceId,
      brandId,
      periodStart,
      periodEnd,
      granularity,
      contributingPromptSetIds: [],
      querySetSize: 0,
      factors: emptyFactors,
      code: 'NO_GSC_CONNECTION',
    };
  }

  // 2. Contributing prompt sets + brand query set.
  const derivation =
    opts?.querySet !== undefined
      ? {
          queries: opts.querySet,
          contributingPromptSetIds: opts.contributingPromptSetIds ?? [],
        }
      : await selectBrandQuerySet(workspaceId, brandId, periodStart, periodEnd);

  if (derivation.contributingPromptSetIds.length === 0) {
    return {
      workspaceId,
      brandId,
      periodStart,
      periodEnd,
      granularity,
      contributingPromptSetIds: [],
      querySetSize: 0,
      factors: emptyFactors,
      code: 'NO_ENABLED_PROMPT_SETS',
    };
  }

  if (derivation.queries.length === 0) {
    return {
      workspaceId,
      brandId,
      periodStart,
      periodEnd,
      granularity,
      contributingPromptSetIds: derivation.contributingPromptSetIds,
      querySetSize: 0,
      factors: emptyFactors,
      code: 'NO_BRAND_QUERY_SET',
    };
  }

  // 3. Aggregates + AIO match count (parallel).
  const [gscAggregates, aioMatchedCount] = await Promise.all([
    getGscAggregates(workspaceId, derivation.queries, periodStart, periodEnd),
    getAioMatchedCount(workspaceId, derivation.queries, periodStart, periodEnd),
  ]);

  const totalImpressions = gscAggregates.totalImpressions;
  const impressions = totalImpressions;
  const querySetSize = derivation.queries.length;

  const [impressionVolume, clickThroughRate, rankQuality, aioPresence] = await Promise.all([
    getImpressionVolumeInput(impressions, querySetSize),
    getCtrInput({
      totalImpressions,
      impressionWeightedCtr: gscAggregates.impressionWeightedCtr,
    }),
    getRankQualityInput({
      totalImpressions,
      impressionWeightedPosition: gscAggregates.impressionWeightedPosition,
    }),
    getAioPresenceInput(aioMatchedCount, querySetSize),
  ]);

  return {
    workspaceId,
    brandId,
    periodStart,
    periodEnd,
    granularity,
    contributingPromptSetIds: derivation.contributingPromptSetIds,
    querySetSize,
    factors: {
      impression_volume: impressionVolume,
      click_through_rate: clickThroughRate,
      rank_quality: rankQuality,
      aio_presence: aioPresence,
    },
  };
}

// --- Period helpers ---
//
// These mirror the helpers in geo-score.inputs.ts. They are deliberately
// duplicated to keep seo-score independent of geo-score; 6.5b's shared-
// primitive extraction (per the PRP) will unify them.

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** (start, end) of the period containing `at` for the given granularity (UTC). */
export function currentPeriod(
  at: Date,
  granularity: Granularity
): { periodStart: string; periodEnd: string } {
  if (granularity === 'weekly') {
    const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    const day = d.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    return { periodStart: fmt(d), periodEnd: fmt(end) };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0));
  return { periodStart: fmt(start), periodEnd: fmt(end) };
}

/** Most recently completed period ending strictly before `now`. */
export function lastCompletePeriod(
  now: Date,
  granularity: Granularity
): { periodStart: string; periodEnd: string } {
  const cur = currentPeriod(now, granularity);
  const start = new Date(`${cur.periodStart}T00:00:00Z`);
  if (granularity === 'weekly') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCMonth(start.getUTCMonth() - 1);
  }
  return currentPeriod(start, granularity);
}

/** Verify that a date is aligned to the granularity's period boundary. */
export function isPeriodAligned(periodStart: string, granularity: Granularity): boolean {
  const d = new Date(`${periodStart}T00:00:00Z`);
  if (granularity === 'weekly') return d.getUTCDay() === 1; // Monday
  return d.getUTCDate() === 1;
}

/** Derive periodEnd from periodStart for the given granularity. */
export function derivePeriodEnd(periodStart: string, granularity: Granularity): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  if (granularity === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 6);
    return fmt(d);
  }
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return fmt(nextMonth);
}
