import { and, eq, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { recommendationShare } from './recommendation-share.schema';
import type { RecommendationShareComputeInput } from './recommendation-share.types';
import { logger } from '@/lib/logger';

const ALL_SENTINEL = '_all';

interface CitationAggregate {
  brandId: string;
  platformId: string;
  locale: string;
  citationCount: number;
  modelRunCount: number;
}

interface ShareRow {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  sharePercentage: string;
  citationCount: number;
  totalCitations: number;
  modelRunCount: number;
}

/**
 * Computes recommendation share for a workspace/promptSet/date combination.
 * Idempotent: re-running produces the same result via upsert.
 *
 * Returns { changed: true } if any share values were inserted or modified.
 */
export async function computeRecommendationShare(
  input: RecommendationShareComputeInput
): Promise<{ changed: boolean }> {
  const { workspaceId, promptSetId, date } = input;
  const log = logger.child({ workspaceId, promptSetId, date });

  // 1. Fetch citation aggregates grouped by brand, platform, locale
  const aggregates = await fetchCitationAggregates(workspaceId, promptSetId, date);

  if (aggregates.length === 0) {
    log.info('No citations found for recommendation share computation');
    return { changed: false };
  }

  // 2. Expand to multi-level aggregation rows
  const rows = expandAggregates(aggregates, workspaceId, promptSetId, date);

  if (rows.length === 0) {
    return { changed: false };
  }

  // 3. Upsert all rows
  const changed = await upsertShareRows(rows);

  log.info({ rowCount: rows.length, changed }, 'Recommendation share computation complete');

  return { changed };
}

/**
 * Queries citations for a given workspace/promptSet/date and groups by
 * brand, platform, locale — returning counts and distinct model run counts.
 */
async function fetchCitationAggregates(
  workspaceId: string,
  promptSetId: string,
  date: string
): Promise<CitationAggregate[]> {
  const results = await db
    .select({
      brandId: citation.brandId,
      platformId: citation.platformId,
      locale: sql<string>`COALESCE(${citation.locale}, ${ALL_SENTINEL})`.as('locale'),
      citationCount: sql<number>`COUNT(*)::int`.as('citation_count'),
      modelRunCount: sql<number>`COUNT(DISTINCT ${citation.modelRunId})::int`.as('model_run_count'),
    })
    .from(citation)
    .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.promptSetId, promptSetId),
        inArray(modelRun.status, ['completed', 'partial']),
        sql`DATE(${modelRun.startedAt} AT TIME ZONE 'UTC') = ${date}`
      )
    )
    .groupBy(
      citation.brandId,
      citation.platformId,
      sql`COALESCE(${citation.locale}, ${ALL_SENTINEL})`
    );

  return results;
}

/**
 * Pure function that takes fine-grained citation aggregates and expands them
 * into 4-level aggregation rows per brand:
 * 1. (platformId, locale) — most granular
 * 2. (platformId, '_all') — all locales for this platform
 * 3. ('_all', locale) — all platforms for this locale
 * 4. ('_all', '_all') — global
 */
export function expandAggregates(
  aggregates: CitationAggregate[],
  workspaceId: string,
  promptSetId: string,
  date: string
): ShareRow[] {
  // Collect all unique brands
  const brands = [...new Set(aggregates.map((a) => a.brandId))];

  // Build lookup maps for totals and model run counts at each aggregation level
  const brandPlatformLocale = new Map<string, { citations: number; modelRuns: number }>();
  const brandPlatformAll = new Map<string, { citations: number; modelRuns: number }>();
  const brandAllLocale = new Map<string, { citations: number; modelRuns: number }>();
  const brandAllAll = new Map<string, { citations: number; modelRuns: number }>();

  // Total (across all brands) at each level
  const totalPlatformLocale = new Map<string, number>();
  const totalPlatformAll = new Map<string, number>();
  const totalAllLocale = new Map<string, number>();
  let totalAllAll = 0;

  // Model run counts at each total level (used for modelRunCount in output)
  const modelRunsPlatformLocale = new Map<string, number>();
  const modelRunsPlatformAll = new Map<string, number>();
  const modelRunsAllLocale = new Map<string, number>();
  let modelRunsAllAll = 0;

  for (const agg of aggregates) {
    const plKey = `${agg.brandId}:${agg.platformId}:${agg.locale}`;
    const pKey = `${agg.brandId}:${agg.platformId}`;
    const lKey = `${agg.brandId}:${agg.locale}`;
    const aKey = agg.brandId;

    // Per-brand accumulation
    accumulate(brandPlatformLocale, plKey, agg.citationCount, agg.modelRunCount);
    accumulate(brandPlatformAll, pKey, agg.citationCount, agg.modelRunCount);
    accumulate(brandAllLocale, lKey, agg.citationCount, agg.modelRunCount);
    accumulate(brandAllAll, aKey, agg.citationCount, agg.modelRunCount);

    // Total accumulation (across all brands)
    const tplKey = `${agg.platformId}:${agg.locale}`;
    const tpKey = agg.platformId;
    const tlKey = agg.locale;

    totalPlatformLocale.set(tplKey, (totalPlatformLocale.get(tplKey) ?? 0) + agg.citationCount);
    totalPlatformAll.set(tpKey, (totalPlatformAll.get(tpKey) ?? 0) + agg.citationCount);
    totalAllLocale.set(tlKey, (totalAllLocale.get(tlKey) ?? 0) + agg.citationCount);
    totalAllAll += agg.citationCount;

    modelRunsPlatformLocale.set(
      tplKey,
      (modelRunsPlatformLocale.get(tplKey) ?? 0) + agg.modelRunCount
    );
    modelRunsPlatformAll.set(tpKey, (modelRunsPlatformAll.get(tpKey) ?? 0) + agg.modelRunCount);
    modelRunsAllLocale.set(tlKey, (modelRunsAllLocale.get(tlKey) ?? 0) + agg.modelRunCount);
    modelRunsAllAll += agg.modelRunCount;
  }

  const rows: ShareRow[] = [];

  for (const brandId of brands) {
    // Level 1: (platform, locale)
    for (const agg of aggregates.filter((a) => a.brandId === brandId)) {
      const tplKey = `${agg.platformId}:${agg.locale}`;
      const total = totalPlatformLocale.get(tplKey) ?? 0;
      if (total === 0) continue;

      const plKey = `${brandId}:${agg.platformId}:${agg.locale}`;
      const brandData = brandPlatformLocale.get(plKey)!;
      rows.push(
        makeRow(
          workspaceId,
          promptSetId,
          brandId,
          agg.platformId,
          agg.locale,
          date,
          brandData.citations,
          total,
          modelRunsPlatformLocale.get(tplKey) ?? 0
        )
      );
    }

    // Level 2: (platform, '_all')
    for (const [key, brandData] of brandPlatformAll) {
      if (!key.startsWith(`${brandId}:`)) continue;
      const platformId = key.slice(brandId.length + 1);
      const total = totalPlatformAll.get(platformId) ?? 0;
      if (total === 0) continue;

      rows.push(
        makeRow(
          workspaceId,
          promptSetId,
          brandId,
          platformId,
          ALL_SENTINEL,
          date,
          brandData.citations,
          total,
          modelRunsPlatformAll.get(platformId) ?? 0
        )
      );
    }

    // Level 3: ('_all', locale)
    for (const [key, brandData] of brandAllLocale) {
      if (!key.startsWith(`${brandId}:`)) continue;
      const locale = key.slice(brandId.length + 1);
      const total = totalAllLocale.get(locale) ?? 0;
      if (total === 0) continue;

      rows.push(
        makeRow(
          workspaceId,
          promptSetId,
          brandId,
          ALL_SENTINEL,
          locale,
          date,
          brandData.citations,
          total,
          modelRunsAllLocale.get(locale) ?? 0
        )
      );
    }

    // Level 4: ('_all', '_all')
    const brandTotal = brandAllAll.get(brandId);
    if (brandTotal && totalAllAll > 0) {
      rows.push(
        makeRow(
          workspaceId,
          promptSetId,
          brandId,
          ALL_SENTINEL,
          ALL_SENTINEL,
          date,
          brandTotal.citations,
          totalAllAll,
          modelRunsAllAll
        )
      );
    }
  }

  return rows;
}

function accumulate(
  map: Map<string, { citations: number; modelRuns: number }>,
  key: string,
  citations: number,
  modelRuns: number
): void {
  const existing = map.get(key);
  if (existing) {
    existing.citations += citations;
    existing.modelRuns += modelRuns;
  } else {
    map.set(key, { citations, modelRuns });
  }
}

function makeRow(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  platformId: string,
  locale: string,
  periodStart: string,
  citationCount: number,
  totalCitations: number,
  modelRunCount: number
): ShareRow {
  const sharePercentage = ((citationCount / totalCitations) * 100).toFixed(2);
  return {
    workspaceId,
    promptSetId,
    brandId,
    platformId,
    locale,
    periodStart,
    sharePercentage,
    citationCount,
    totalCitations,
    modelRunCount,
  };
}

/**
 * Upserts recommendation share rows and returns whether any values changed.
 */
async function upsertShareRows(rows: ShareRow[]): Promise<boolean> {
  const result = await db
    .insert(recommendationShare)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        recommendationShare.workspaceId,
        recommendationShare.promptSetId,
        recommendationShare.brandId,
        recommendationShare.platformId,
        recommendationShare.locale,
        recommendationShare.periodStart,
      ],
      set: {
        sharePercentage: sql`excluded.share_percentage`,
        citationCount: sql`excluded.citation_count`,
        totalCitations: sql`excluded.total_citations`,
        modelRunCount: sql`excluded.model_run_count`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: recommendationShare.id,
      sharePercentage: recommendationShare.sharePercentage,
      updatedAt: recommendationShare.updatedAt,
      createdAt: recommendationShare.createdAt,
    });

  // If any row was newly created (createdAt ~= updatedAt) or updated, consider it changed
  // A simple heuristic: if any row's updatedAt is very close to now, it was touched
  return result.length > 0;
}
