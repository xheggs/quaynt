/**
 * Collects the raw inputs for one brand's GEO Score across all enabled prompt sets.
 *
 * Rolls up:
 *  - Counts: summed
 *  - Ratios/averages: citation-count-weighted
 *  - Distinct sets (domains, platform-locale pairs): unioned
 */

import { and, eq, gte, inArray, isNull, lte, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recommendationShare } from './recommendation-share.schema';
import { sentimentAggregate } from './sentiment-aggregate.schema';
import { positionAggregate } from './position-aggregate.schema';
import { citationSourceAggregate } from './citation-source-aggregate.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';
import { generatePeriods } from './trend.service';
import { POSITION_STABILITY_MIN_POINTS, POSITION_STABILITY_WINDOW } from './geo-score.formula';
import type { FactorInputs, GeoScoreInputs, Granularity } from './geo-score.types';

const ALL = '_all';

// --- Rollup helpers (pure, exported for unit testing) ---

export interface WeightedSample {
  value: number | null;
  weight: number;
}

/**
 * Weighted average over samples (citation-count weighted).
 * Samples with weight 0 contribute nothing. Returns null when total weight is 0.
 */
export function rollupWeightedRatio(samples: WeightedSample[]): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const s of samples) {
    if (s.value === null || s.weight <= 0) continue;
    weighted += s.value * s.weight;
    totalWeight += s.weight;
  }
  if (totalWeight === 0) return null;
  return weighted / totalWeight;
}

export function rollupSum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export function rollupUnion<T>(sets: T[][]): T[] {
  const seen = new Set<T>();
  for (const set of sets) {
    for (const v of set) seen.add(v);
  }
  return Array.from(seen);
}

/** Coefficient of variation of a list of numbers. */
export function coefficientOfVariation(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return sd / Math.abs(mean);
}

// --- Scope resolution ---

/**
 * Returns the IDs of non-deleted prompt sets in the workspace that have at least one
 * recommendation_share row for this brand — i.e., prompt sets that actively track it.
 */
export async function selectContributingPromptSets(
  workspaceId: string,
  brandId: string
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ promptSetId: recommendationShare.promptSetId })
    .from(recommendationShare)
    .innerJoin(promptSet, eq(recommendationShare.promptSetId, promptSet.id))
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.brandId, brandId),
        isNull(promptSet.deletedAt)
      )
    );
  return rows.map((r) => r.promptSetId);
}

// --- Per-factor input collectors ---

async function getCitationFrequencyInput(
  workspaceId: string,
  brandId: string,
  promptSetIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<FactorInputs['citation_frequency']> {
  if (promptSetIds.length === 0) return null;
  const rows = await db
    .select({
      promptSetId: recommendationShare.promptSetId,
      sharePercentage: recommendationShare.sharePercentage,
      citationCount: recommendationShare.citationCount,
      totalCitations: recommendationShare.totalCitations,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.brandId, brandId),
        inArray(recommendationShare.promptSetId, promptSetIds),
        eq(recommendationShare.platformId, ALL),
        eq(recommendationShare.locale, ALL),
        gte(recommendationShare.periodStart, periodStart),
        lte(recommendationShare.periodStart, periodEnd)
      )
    );

  if (rows.length === 0) return null;

  const samples = rows.map((r) => ({
    value: parseFloat(r.sharePercentage),
    weight: r.totalCitations,
  }));
  const share = rollupWeightedRatio(samples);
  const totalCitations = rollupSum(rows.map((r) => r.totalCitations));
  return { sharePercentage: share, totalCitations };
}

async function getSourceDiversityInput(
  workspaceId: string,
  brandId: string,
  promptSetIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<FactorInputs['source_diversity']> {
  if (promptSetIds.length === 0) return null;
  const rows = await db
    .selectDistinct({ domain: citationSourceAggregate.domain })
    .from(citationSourceAggregate)
    .where(
      and(
        eq(citationSourceAggregate.workspaceId, workspaceId),
        eq(citationSourceAggregate.brandId, brandId),
        inArray(citationSourceAggregate.promptSetId, promptSetIds),
        gte(citationSourceAggregate.periodStart, periodStart),
        lte(citationSourceAggregate.periodStart, periodEnd)
      )
    );
  return { domainCount: rows.length };
}

async function getSentimentBalanceInput(
  workspaceId: string,
  brandId: string,
  promptSetIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<FactorInputs['sentiment_balance']> {
  if (promptSetIds.length === 0) return null;
  const rows = await db
    .select({
      netSentimentScore: sentimentAggregate.netSentimentScore,
      totalCount: sentimentAggregate.totalCount,
    })
    .from(sentimentAggregate)
    .where(
      and(
        eq(sentimentAggregate.workspaceId, workspaceId),
        eq(sentimentAggregate.brandId, brandId),
        inArray(sentimentAggregate.promptSetId, promptSetIds),
        eq(sentimentAggregate.platformId, ALL),
        eq(sentimentAggregate.locale, ALL),
        gte(sentimentAggregate.periodStart, periodStart),
        lte(sentimentAggregate.periodStart, periodEnd)
      )
    );
  if (rows.length === 0) return null;

  // Sentiment score column is stored on a 0-100 scale (see trend.service). Convert to -1..+1.
  const samples = rows.map((r) => ({
    value: parseFloat(r.netSentimentScore) / 100,
    weight: r.totalCount,
  }));
  const net = rollupWeightedRatio(samples);
  const totalCitations = rollupSum(rows.map((r) => r.totalCount));
  return { netSentimentScore: net, totalCitations };
}

async function getPositionStabilityInput(
  workspaceId: string,
  brandId: string,
  promptSetIds: string[],
  periodStart: string,
  periodEnd: string,
  granularity: Granularity
): Promise<FactorInputs['position_stability']> {
  const window = POSITION_STABILITY_WINDOW[granularity];
  if (promptSetIds.length === 0) {
    return { firstMentionRate: null, cv: null, window: { granularity, periodsUsed: 0 } };
  }

  // Current-period first-mention rate (citation-count-weighted across prompt sets)
  const currentRows = await db
    .select({
      firstMentionRate: positionAggregate.firstMentionRate,
      citationCount: positionAggregate.citationCount,
    })
    .from(positionAggregate)
    .where(
      and(
        eq(positionAggregate.workspaceId, workspaceId),
        eq(positionAggregate.brandId, brandId),
        inArray(positionAggregate.promptSetId, promptSetIds),
        eq(positionAggregate.platformId, ALL),
        eq(positionAggregate.locale, ALL),
        gte(positionAggregate.periodStart, periodStart),
        lte(positionAggregate.periodStart, periodEnd)
      )
    );

  const firstMentionRate = rollupWeightedRatio(
    currentRows.map((r) => ({
      // firstMentionRate is stored as 0-100 → convert to 0-1
      value: parseFloat(r.firstMentionRate) / 100,
      weight: r.citationCount,
    }))
  );

  // Trailing window of rolled-up averagePosition values
  const trailingRows = await db
    .select({
      periodStart: positionAggregate.periodStart,
      averagePosition: positionAggregate.averagePosition,
      citationCount: positionAggregate.citationCount,
    })
    .from(positionAggregate)
    .where(
      and(
        eq(positionAggregate.workspaceId, workspaceId),
        eq(positionAggregate.brandId, brandId),
        inArray(positionAggregate.promptSetId, promptSetIds),
        eq(positionAggregate.platformId, ALL),
        eq(positionAggregate.locale, ALL),
        lte(positionAggregate.periodStart, periodEnd)
      )
    )
    .orderBy(desc(positionAggregate.periodStart));

  // Group by periodStart, citation-count weighted average
  const perPeriod = new Map<string, { weighted: number; total: number }>();
  for (const r of trailingRows) {
    if (r.citationCount === 0) continue;
    const v = parseFloat(r.averagePosition);
    const existing = perPeriod.get(r.periodStart) ?? { weighted: 0, total: 0 };
    existing.weighted += v * r.citationCount;
    existing.total += r.citationCount;
    perPeriod.set(r.periodStart, existing);
  }

  const avgByPeriod = Array.from(perPeriod.entries())
    .filter(([, v]) => v.total > 0)
    .map(([k, v]) => ({ periodStart: k, value: v.weighted / v.total }))
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1)) // newest first
    .slice(0, window);

  if (avgByPeriod.length < POSITION_STABILITY_MIN_POINTS) {
    return {
      firstMentionRate,
      cv: null,
      window: { granularity, periodsUsed: avgByPeriod.length },
    };
  }

  const cv = coefficientOfVariation(avgByPeriod.map((p) => p.value));
  return {
    firstMentionRate,
    cv,
    window: { granularity, periodsUsed: avgByPeriod.length },
  };
}

async function getAccuracyInput(): Promise<FactorInputs['accuracy']> {
  // Module 2.8 is not yet implemented — hallucination rate is unavailable.
  // When it ships, this function returns { hallucinationRate } and the factor activates.
  return null;
}

async function getCoverageBreadthInput(
  workspaceId: string,
  brandId: string,
  promptSetIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<FactorInputs['coverage_breadth']> {
  if (promptSetIds.length === 0) return null;

  // Observed (platform, locale) pairs with any citation for this brand in the period
  const observedRows = await db
    .selectDistinct({
      platformId: recommendationShare.platformId,
      locale: recommendationShare.locale,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.brandId, brandId),
        inArray(recommendationShare.promptSetId, promptSetIds),
        sql`${recommendationShare.platformId} <> ${ALL}`,
        sql`${recommendationShare.locale} <> ${ALL}`,
        sql`${recommendationShare.citationCount} > 0`,
        gte(recommendationShare.periodStart, periodStart),
        lte(recommendationShare.periodStart, periodEnd)
      )
    );
  const observedPairs = observedRows.length;

  // Expected (platform, locale) pairs: distinct pairs ever configured in model runs for
  // this brand across these prompt sets (all time). A null locale is stored as 'en' default? We
  // exclude null locale runs from the denominator — they don't tell us the configured set.
  const expectedRows = await db
    .selectDistinct({
      platformId: modelRunResult.platformId,
      locale: modelRun.locale,
    })
    .from(modelRunResult)
    .innerJoin(modelRun, eq(modelRunResult.modelRunId, modelRun.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.brandId, brandId),
        inArray(modelRun.promptSetId, promptSetIds),
        sql`${modelRun.locale} IS NOT NULL`
      )
    );

  if (expectedRows.length === 0) {
    return {
      observedPairs,
      expectedPairs: null,
      expectedSource: null,
    };
  }

  return {
    observedPairs,
    expectedPairs: expectedRows.length,
    expectedSource: 'promptSetConfig',
  };
}

// --- Main orchestrator ---

export interface CollectInputsOptions {
  /** Override the contributing prompt sets (for testing / alternative scopes). */
  promptSetIds?: string[];
}

/**
 * Collects all factor inputs for one brand over one period, rolling up across
 * every enabled prompt set that tracks the brand.
 */
export async function collectInputs(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity,
  opts?: CollectInputsOptions
): Promise<GeoScoreInputs> {
  const promptSetIds =
    opts?.promptSetIds ?? (await selectContributingPromptSets(workspaceId, brandId));

  if (promptSetIds.length === 0) {
    return {
      workspaceId,
      brandId,
      periodStart,
      periodEnd,
      granularity,
      contributingPromptSetIds: [],
      factors: {
        citation_frequency: null,
        source_diversity: null,
        sentiment_balance: null,
        position_stability: null,
        accuracy: null,
        coverage_breadth: null,
      },
    };
  }

  const [
    citationFrequency,
    sourceDiversity,
    sentimentBalance,
    positionStability,
    accuracy,
    coverageBreadth,
  ] = await Promise.all([
    getCitationFrequencyInput(workspaceId, brandId, promptSetIds, periodStart, periodEnd),
    getSourceDiversityInput(workspaceId, brandId, promptSetIds, periodStart, periodEnd),
    getSentimentBalanceInput(workspaceId, brandId, promptSetIds, periodStart, periodEnd),
    getPositionStabilityInput(
      workspaceId,
      brandId,
      promptSetIds,
      periodStart,
      periodEnd,
      granularity
    ),
    getAccuracyInput(),
    getCoverageBreadthInput(workspaceId, brandId, promptSetIds, periodStart, periodEnd),
  ]);

  return {
    workspaceId,
    brandId,
    periodStart,
    periodEnd,
    granularity,
    contributingPromptSetIds: promptSetIds,
    factors: {
      citation_frequency: citationFrequency,
      source_diversity: sourceDiversity,
      sentiment_balance: sentimentBalance,
      position_stability: positionStability,
      accuracy,
      coverage_breadth: coverageBreadth,
    },
  };
}

/** Derive the current period's (start, end) for the given granularity anchored to `at`. */
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
  const start = new Date(cur.periodStart + 'T00:00:00Z');
  if (granularity === 'weekly') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCMonth(start.getUTCMonth() - 1);
  }
  return currentPeriod(start, granularity);
}

/** Verify that a date is aligned to the granularity's period boundary. */
export function isPeriodAligned(periodStart: string, granularity: Granularity): boolean {
  const d = new Date(periodStart + 'T00:00:00Z');
  if (granularity === 'weekly') {
    return d.getUTCDay() === 1; // Monday
  }
  return d.getUTCDate() === 1;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Re-exports for tests using internals
export { generatePeriods };
