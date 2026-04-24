/**
 * SEO Score service — orchestrates input collection, formula, persistence, and trend reads.
 *
 * Mirrors geo-score.service.ts method-by-method. Reuses trend.stats.ts for
 * delta/EWMA/direction. Shares no in-memory state with the GEO score.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { gscConnection } from '@/modules/integrations/gsc/gsc-connection.schema';
import { seoScoreSnapshot } from './seo-score-snapshot.schema';
import { collectInputs } from './seo-score.inputs';
import {
  FORMULA_VERSION,
  buildFactorResult,
  composeScore,
  detectAdvisories,
  scoreAioPresence,
  scoreCtr,
  scoreImpressionVolume,
  scoreRankQuality,
} from './seo-score.formula';
import { generateRecommendations } from './seo-score.recommendations';
import type {
  DataQualityAdvisory,
  Granularity,
  SeoFactorResult,
  SeoScoreCode,
  SeoScoreInputs,
  SeoScoreRecommendation,
  SeoScoreResult,
} from './seo-score.types';

const ALL = '_all';

export interface ComputeSeoScoreOptions {
  platformId?: string;
  locale?: string;
  inputs?: SeoScoreInputs;
}

/**
 * Run the scoring engine for one brand over one period. Pure orchestration —
 * does NOT persist. Use `computeAndPersist` for that.
 */
export async function computeScore(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity,
  opts: ComputeSeoScoreOptions = {}
): Promise<SeoScoreResult> {
  const platformId = opts.platformId ?? ALL;
  const locale = opts.locale ?? ALL;

  const inputs =
    opts.inputs ?? (await collectInputs(workspaceId, brandId, periodStart, periodEnd, granularity));

  return runScoringEngine({
    inputs,
    workspaceId,
    brandId,
    periodStart,
    periodEnd,
    granularity,
    platformId,
    locale,
  });
}

/**
 * Pure composition of factor results + composite + recommendations from
 * SeoScoreInputs. Exported for testing with seeded inputs.
 */
export function runScoringEngine(args: {
  inputs: SeoScoreInputs;
  workspaceId: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  platformId: string;
  locale: string;
}): SeoScoreResult {
  const { inputs } = args;
  const dataQualityAdvisories = detectAdvisories(args.periodStart, args.periodEnd);

  // Early-exit when inputs carry an explicit code.
  if (inputs.code) {
    return buildEmptyResult(args, inputs.code, dataQualityAdvisories);
  }

  const factors: SeoFactorResult[] = [
    buildFactorResult(
      'impression_volume',
      scoreImpressionVolume(inputs.factors.impression_volume),
      inputs.factors.impression_volume ?? {}
    ),
    buildFactorResult(
      'click_through_rate',
      scoreCtr(inputs.factors.click_through_rate),
      inputs.factors.click_through_rate ?? {}
    ),
    buildFactorResult(
      'rank_quality',
      scoreRankQuality(inputs.factors.rank_quality),
      inputs.factors.rank_quality ?? {}
    ),
    buildFactorResult(
      'aio_presence',
      scoreAioPresence(inputs.factors.aio_presence),
      inputs.factors.aio_presence ?? {}
    ),
  ];

  const compositeResult = composeScore(factors);
  const recommendations: SeoScoreRecommendation[] =
    compositeResult.composite === null ? [] : generateRecommendations(factors);

  return {
    workspaceId: args.workspaceId,
    brandId: args.brandId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    granularity: args.granularity,
    platformId: args.platformId,
    locale: args.locale,
    formulaVersion: FORMULA_VERSION,
    computedAt: new Date(),
    contributingPromptSetIds: inputs.contributingPromptSetIds,
    querySetSize: inputs.querySetSize,
    dataQualityAdvisories,
    composite: compositeResult.composite,
    compositeRaw: compositeResult.compositeRaw,
    displayCapApplied: compositeResult.displayCapApplied,
    code: compositeResult.code,
    factors,
    recommendations,
  };
}

function buildEmptyResult(
  args: {
    workspaceId: string;
    brandId: string;
    periodStart: string;
    periodEnd: string;
    granularity: Granularity;
    platformId: string;
    locale: string;
    inputs: SeoScoreInputs;
  },
  code: SeoScoreCode,
  dataQualityAdvisories: DataQualityAdvisory[]
): SeoScoreResult {
  const reason = code.toLowerCase();
  const factors: SeoFactorResult[] = [
    buildFactorResult('impression_volume', { score: null, status: 'insufficientData', reason }, {}),
    buildFactorResult(
      'click_through_rate',
      { score: null, status: 'insufficientData', reason },
      {}
    ),
    buildFactorResult('rank_quality', { score: null, status: 'insufficientData', reason }, {}),
    buildFactorResult('aio_presence', { score: null, status: 'insufficientData', reason }, {}),
  ];

  return {
    workspaceId: args.workspaceId,
    brandId: args.brandId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    granularity: args.granularity,
    platformId: args.platformId,
    locale: args.locale,
    formulaVersion: FORMULA_VERSION,
    computedAt: new Date(),
    contributingPromptSetIds: args.inputs.contributingPromptSetIds,
    querySetSize: args.inputs.querySetSize,
    dataQualityAdvisories,
    composite: null,
    compositeRaw: null,
    displayCapApplied: false,
    code,
    factors,
    recommendations: [],
  };
}

// --- Persistence ---

export async function upsertSnapshot(result: SeoScoreResult): Promise<void> {
  await db
    .insert(seoScoreSnapshot)
    .values({
      workspaceId: result.workspaceId,
      brandId: result.brandId,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      granularity: result.granularity,
      platformId: result.platformId,
      locale: result.locale,
      composite: result.composite === null ? null : String(result.composite),
      compositeRaw: result.compositeRaw === null ? null : String(result.compositeRaw),
      displayCapApplied: result.displayCapApplied,
      formulaVersion: result.formulaVersion,
      contributingPromptSetIds: result.contributingPromptSetIds,
      querySetSize: result.querySetSize,
      dataQualityAdvisories: result.dataQualityAdvisories,
      code: result.code ?? null,
      factors: result.factors,
      inputs: { factors: result.factors.map((f) => f.inputs) },
      computedAt: result.computedAt,
    })
    .onConflictDoUpdate({
      target: [
        seoScoreSnapshot.workspaceId,
        seoScoreSnapshot.brandId,
        seoScoreSnapshot.periodStart,
        seoScoreSnapshot.granularity,
        seoScoreSnapshot.platformId,
        seoScoreSnapshot.locale,
      ],
      set: {
        composite: sql`excluded.composite`,
        compositeRaw: sql`excluded.composite_raw`,
        displayCapApplied: sql`excluded.display_cap_applied`,
        formulaVersion: sql`excluded.formula_version`,
        contributingPromptSetIds: sql`excluded.contributing_prompt_set_ids`,
        querySetSize: sql`excluded.query_set_size`,
        dataQualityAdvisories: sql`excluded.data_quality_advisories`,
        code: sql`excluded.code`,
        factors: sql`excluded.factors`,
        inputs: sql`excluded.inputs`,
        computedAt: sql`excluded.computed_at`,
        updatedAt: sql`now()`,
      },
    });
}

export async function computeAndPersist(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity,
  opts: ComputeSeoScoreOptions = {}
): Promise<SeoScoreResult> {
  const result = await computeScore(
    workspaceId,
    brandId,
    periodStart,
    periodEnd,
    granularity,
    opts
  );
  await upsertSnapshot(result);
  return result;
}

// --- Reads & trend ---
// Read/trend operations live in ./seo-score.queries; re-exported below for
// callers that import from '@/modules/visibility/seo-score.service'.
export { getLatestSnapshot, listSnapshots, getScoreTrend } from './seo-score.queries';
export type { SeoSnapshotRow, SeoTrendStats } from './seo-score.queries';

// --- Recommendations endpoint ---

export async function getRecommendations(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity
): Promise<SeoScoreRecommendation[]> {
  const result = await computeScore(workspaceId, brandId, periodStart, periodEnd, granularity);
  return result.recommendations;
}

// --- Active brands enumeration (for daily job) ---

export interface ActiveSeoBrand {
  workspaceId: string;
  brandId: string;
}

/**
 * Brands (non-deleted) whose workspace has at least one active GSC connection.
 * Prompt-set filtering is handled inside `collectInputs`; this function only
 * gates on the workspace-level prerequisite.
 */
export async function listActiveBrandsWithGsc(): Promise<ActiveSeoBrand[]> {
  const rows = await db
    .selectDistinct({
      workspaceId: brand.workspaceId,
      brandId: brand.id,
    })
    .from(brand)
    .innerJoin(gscConnection, eq(gscConnection.workspaceId, brand.workspaceId))
    .where(and(isNull(brand.deletedAt), eq(gscConnection.status, 'active')));

  return rows.map((r) => ({ workspaceId: r.workspaceId, brandId: r.brandId }));
}
