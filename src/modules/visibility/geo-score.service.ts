/**
 * Scoring service — orchestrates input collection, formula, persistence, and trend reads.
 */

import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { geoScoreSnapshot } from './geo-score-snapshot.schema';
import { collectInputs } from './geo-score.inputs';
import {
  FORMULA_VERSION,
  buildFactorResult,
  composeScore,
  scoreAccuracy,
  scoreCitationFrequency,
  scoreCoverageBreadth,
  scorePositionStability,
  scoreSentimentBalance,
  scoreSourceDiversity,
} from './geo-score.formula';
import { generateRecommendations } from './geo-score.recommendations';
import { computeDelta, computeEWMA, computeOverallDirection } from './trend.stats';
import type {
  FactorResult,
  GeoScoreInputs,
  GeoScoreRecommendation,
  GeoScoreResult,
  Granularity,
} from './geo-score.types';

const ALL = '_all';

export interface ComputeScoreOptions {
  platformId?: string;
  locale?: string;
  inputs?: GeoScoreInputs;
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
  opts: ComputeScoreOptions = {}
): Promise<GeoScoreResult> {
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
 * Pure composition of factor results + composite + recommendations from GeoScoreInputs.
 * Exported for testing with seeded inputs.
 */
export function runScoringEngine(args: {
  inputs: GeoScoreInputs;
  workspaceId: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  platformId: string;
  locale: string;
}): GeoScoreResult {
  const { inputs } = args;

  if (inputs.contributingPromptSetIds.length === 0) {
    const factors = buildEmptyFactors();
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
      contributingPromptSetIds: [],
      composite: null,
      compositeRaw: null,
      displayCapApplied: false,
      code: 'NO_ENABLED_PROMPT_SETS',
      factors,
      recommendations: [],
    };
  }

  const factors: FactorResult[] = [
    buildFactorResult(
      'citation_frequency',
      scoreCitationFrequency(inputs.factors.citation_frequency),
      inputs.factors.citation_frequency ?? {}
    ),
    buildFactorResult(
      'source_diversity',
      scoreSourceDiversity(inputs.factors.source_diversity),
      inputs.factors.source_diversity ?? {}
    ),
    buildFactorResult(
      'sentiment_balance',
      scoreSentimentBalance(inputs.factors.sentiment_balance),
      inputs.factors.sentiment_balance ?? {}
    ),
    buildFactorResult(
      'position_stability',
      scorePositionStability(inputs.factors.position_stability),
      inputs.factors.position_stability ?? {}
    ),
    buildFactorResult(
      'accuracy',
      scoreAccuracy(inputs.factors.accuracy),
      inputs.factors.accuracy ?? {}
    ),
    buildFactorResult(
      'coverage_breadth',
      scoreCoverageBreadth(inputs.factors.coverage_breadth),
      inputs.factors.coverage_breadth ?? {}
    ),
  ];

  const compositeResult = composeScore(factors);
  const recommendations: GeoScoreRecommendation[] =
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
    composite: compositeResult.composite,
    compositeRaw: compositeResult.compositeRaw,
    displayCapApplied: compositeResult.displayCapApplied,
    code: compositeResult.code,
    factors,
    recommendations,
  };
}

function buildEmptyFactors(): FactorResult[] {
  return [
    buildFactorResult(
      'citation_frequency',
      { score: null, status: 'insufficientData', reason: 'no_enabled_prompt_sets' },
      {}
    ),
    buildFactorResult(
      'source_diversity',
      { score: null, status: 'insufficientData', reason: 'no_enabled_prompt_sets' },
      {}
    ),
    buildFactorResult(
      'sentiment_balance',
      { score: null, status: 'insufficientData', reason: 'no_enabled_prompt_sets' },
      {}
    ),
    buildFactorResult(
      'position_stability',
      { score: null, status: 'insufficientData', reason: 'no_enabled_prompt_sets' },
      {}
    ),
    buildFactorResult(
      'accuracy',
      { score: null, status: 'notYetScored', reason: 'accuracy_module_not_live' },
      {}
    ),
    buildFactorResult(
      'coverage_breadth',
      { score: null, status: 'insufficientData', reason: 'no_enabled_prompt_sets' },
      {}
    ),
  ];
}

// --- Persistence ---

export async function upsertSnapshot(result: GeoScoreResult): Promise<void> {
  await db
    .insert(geoScoreSnapshot)
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
      factors: result.factors,
      inputs: { factors: result.factors.map((f) => f.inputs) },
      computedAt: result.computedAt,
    })
    .onConflictDoUpdate({
      target: [
        geoScoreSnapshot.workspaceId,
        geoScoreSnapshot.brandId,
        geoScoreSnapshot.periodStart,
        geoScoreSnapshot.granularity,
        geoScoreSnapshot.platformId,
        geoScoreSnapshot.locale,
      ],
      set: {
        composite: sql`excluded.composite`,
        compositeRaw: sql`excluded.composite_raw`,
        displayCapApplied: sql`excluded.display_cap_applied`,
        formulaVersion: sql`excluded.formula_version`,
        contributingPromptSetIds: sql`excluded.contributing_prompt_set_ids`,
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
  opts: ComputeScoreOptions = {}
): Promise<GeoScoreResult> {
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

// --- Reads ---

export interface SnapshotRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  granularity: string;
  platformId: string;
  locale: string;
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  formulaVersion: number;
  contributingPromptSetIds: string[];
  factors: FactorResult[];
  computedAt: Date;
}

function mapSnapshot(row: {
  id: string;
  periodStart: string;
  periodEnd: string;
  granularity: string;
  platformId: string;
  locale: string;
  composite: string | null;
  compositeRaw: string | null;
  displayCapApplied: boolean;
  formulaVersion: number;
  contributingPromptSetIds: string[];
  factors: unknown;
  computedAt: Date;
}): SnapshotRow {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    granularity: row.granularity,
    platformId: row.platformId,
    locale: row.locale,
    composite: row.composite === null ? null : parseFloat(row.composite),
    compositeRaw: row.compositeRaw === null ? null : parseFloat(row.compositeRaw),
    displayCapApplied: row.displayCapApplied,
    formulaVersion: row.formulaVersion,
    contributingPromptSetIds: row.contributingPromptSetIds,
    factors: row.factors as FactorResult[],
    computedAt: row.computedAt,
  };
}

export async function getLatestSnapshot(
  workspaceId: string,
  brandId: string,
  granularity: Granularity,
  platformId: string = ALL,
  locale: string = ALL
): Promise<SnapshotRow | null> {
  const [row] = await db
    .select({
      id: geoScoreSnapshot.id,
      periodStart: geoScoreSnapshot.periodStart,
      periodEnd: geoScoreSnapshot.periodEnd,
      granularity: geoScoreSnapshot.granularity,
      platformId: geoScoreSnapshot.platformId,
      locale: geoScoreSnapshot.locale,
      composite: geoScoreSnapshot.composite,
      compositeRaw: geoScoreSnapshot.compositeRaw,
      displayCapApplied: geoScoreSnapshot.displayCapApplied,
      formulaVersion: geoScoreSnapshot.formulaVersion,
      contributingPromptSetIds: geoScoreSnapshot.contributingPromptSetIds,
      factors: geoScoreSnapshot.factors,
      computedAt: geoScoreSnapshot.computedAt,
    })
    .from(geoScoreSnapshot)
    .where(
      and(
        eq(geoScoreSnapshot.workspaceId, workspaceId),
        eq(geoScoreSnapshot.brandId, brandId),
        eq(geoScoreSnapshot.granularity, granularity),
        eq(geoScoreSnapshot.platformId, platformId),
        eq(geoScoreSnapshot.locale, locale)
      )
    )
    .orderBy(desc(geoScoreSnapshot.periodStart))
    .limit(1);

  return row ? mapSnapshot(row) : null;
}

export async function listSnapshots(
  workspaceId: string,
  brandId: string,
  from: string,
  to: string,
  granularity: Granularity,
  platformId: string = ALL,
  locale: string = ALL
): Promise<SnapshotRow[]> {
  const rows = await db
    .select({
      id: geoScoreSnapshot.id,
      periodStart: geoScoreSnapshot.periodStart,
      periodEnd: geoScoreSnapshot.periodEnd,
      granularity: geoScoreSnapshot.granularity,
      platformId: geoScoreSnapshot.platformId,
      locale: geoScoreSnapshot.locale,
      composite: geoScoreSnapshot.composite,
      compositeRaw: geoScoreSnapshot.compositeRaw,
      displayCapApplied: geoScoreSnapshot.displayCapApplied,
      formulaVersion: geoScoreSnapshot.formulaVersion,
      contributingPromptSetIds: geoScoreSnapshot.contributingPromptSetIds,
      factors: geoScoreSnapshot.factors,
      computedAt: geoScoreSnapshot.computedAt,
    })
    .from(geoScoreSnapshot)
    .where(
      and(
        eq(geoScoreSnapshot.workspaceId, workspaceId),
        eq(geoScoreSnapshot.brandId, brandId),
        eq(geoScoreSnapshot.granularity, granularity),
        eq(geoScoreSnapshot.platformId, platformId),
        eq(geoScoreSnapshot.locale, locale),
        gte(geoScoreSnapshot.periodStart, from),
        lte(geoScoreSnapshot.periodStart, to)
      )
    )
    .orderBy(geoScoreSnapshot.periodStart);

  return rows.map(mapSnapshot);
}

// --- Trend ---

export interface TrendStats {
  delta: number | null;
  changeRate: number | null;
  direction: 'up' | 'down' | 'stable' | null;
  ewma: number[];
  overallDirection: 'up' | 'down' | 'stable' | null;
}

export async function getScoreTrend(
  workspaceId: string,
  brandId: string,
  from: string,
  to: string,
  granularity: Granularity
): Promise<{
  snapshots: SnapshotRow[];
  trend: TrendStats;
  formulaVersionChanges: Array<{ periodStart: string; fromVersion: number; toVersion: number }>;
}> {
  const snapshots = await listSnapshots(workspaceId, brandId, from, to, granularity);

  const composites = snapshots.map((s) => s.composite).filter((v): v is number => v !== null);

  if (composites.length === 0) {
    return {
      snapshots,
      trend: { delta: null, changeRate: null, direction: null, ewma: [], overallDirection: null },
      formulaVersionChanges: detectFormulaVersionChanges(snapshots),
    };
  }

  const last = composites[composites.length - 1];
  const prev = composites.length > 1 ? composites[composites.length - 2] : null;
  const deltaR = prev !== null ? computeDelta(last, prev) : null;
  const overallDirection =
    composites.length > 1
      ? computeOverallDirection(composites[0], composites[composites.length - 1])
      : null;

  return {
    snapshots,
    trend: {
      delta: deltaR?.delta ?? null,
      changeRate: deltaR?.changeRate ?? null,
      direction: deltaR?.direction ?? null,
      ewma: computeEWMA(composites),
      overallDirection,
    },
    formulaVersionChanges: detectFormulaVersionChanges(snapshots),
  };
}

function detectFormulaVersionChanges(
  snapshots: SnapshotRow[]
): Array<{ periodStart: string; fromVersion: number; toVersion: number }> {
  const changes: Array<{ periodStart: string; fromVersion: number; toVersion: number }> = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    if (prev.formulaVersion !== cur.formulaVersion) {
      changes.push({
        periodStart: cur.periodStart,
        fromVersion: prev.formulaVersion,
        toVersion: cur.formulaVersion,
      });
    }
  }
  return changes;
}

// --- Recommendations endpoint ---

export async function getRecommendations(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity
): Promise<GeoScoreRecommendation[]> {
  const result = await computeScore(workspaceId, brandId, periodStart, periodEnd, granularity);
  return result.recommendations;
}

// --- Active brands enumeration (for daily job) ---

export interface ActiveBrand {
  workspaceId: string;
  brandId: string;
}

/**
 * Brands (non-deleted) with ≥1 contributing prompt set, enumerated via recommendation_share.
 * Prompt-set filter (non-deleted) is handled by selectContributingPromptSets.
 */
export async function listActiveBrands(): Promise<ActiveBrand[]> {
  const rows = await db
    .selectDistinct({
      workspaceId: brand.workspaceId,
      brandId: brand.id,
    })
    .from(brand)
    .where(isNull(brand.deletedAt));

  return rows.map((r) => ({ workspaceId: r.workspaceId, brandId: r.brandId }));
}
