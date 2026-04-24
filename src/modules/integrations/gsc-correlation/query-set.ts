/**
 * Shared helpers for deriving the "query set" — the set of distinct query text
 * values (lowercased + trimmed) that bridge AI citations and GSC query data.
 *
 * Two consumers today:
 *   - 6.2c GSC correlation: workspace-scoped AI-cited queries (any brand).
 *   - 6.5a SEO Score: brand-scoped, restricted to prompt sets that track the
 *     brand, filtered by period.
 *
 * The normalization is `lower(trim(...))` on both sides of the join; this is
 * the only join key between GSC query text and Quaynt prompt text.
 */

import { and, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { gscQueryPerformance } from './gsc-query-performance.schema';

const AIO_PLATFORM_ID = 'aio';

/** SQL fragment: `lower(trim(model_run_result.interpolated_prompt))`. */
export const lowerTrimInterpolatedPrompt: SQL<string> = sql<string>`lower(trim(${modelRunResult.interpolatedPrompt}))`;

/** SQL fragment: `lower(trim(gsc_query_performance.query))`. */
export const lowerTrimGscQuery: SQL<string> = sql<string>`lower(trim(${gscQueryPerformance.query}))`;

/**
 * Workspace-level: distinct query text values (lowercased + trimmed) for
 * which the workspace has at least one AIO citation in the date range.
 *
 * Used by 6.2c GSC correlation. Behavior preserved from the previous inline
 * `getAiCitedQueries` helper.
 */
export async function selectAiCitedQueriesForWorkspace(
  workspaceId: string,
  from: string,
  to: string
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ q: lowerTrimInterpolatedPrompt })
    .from(citation)
    .innerJoin(modelRunResult, eq(modelRunResult.id, citation.modelRunResultId))
    .where(
      and(
        eq(citation.workspaceId, workspaceId),
        eq(citation.platformId, AIO_PLATFORM_ID),
        gte(citation.createdAt, new Date(from)),
        lte(citation.createdAt, new Date(`${to}T23:59:59.999Z`))
      )
    );

  return rows.map((r) => r.q).filter((q): q is string => !!q);
}

/**
 * Brand-level: the set of distinct query text values (lowercased + trimmed)
 * derived from model_run_result rows produced by prompt sets in the workspace
 * that track the given brand, whose model runs executed within the period.
 *
 * Also returns the list of contributing prompt set IDs — callers can reuse
 * this to avoid a second query for snapshot persistence.
 *
 * A brand's "tracking" prompt sets are the same set GEO score uses: any
 * non-deleted prompt set in the workspace that has model runs producing
 * results for the brand in the period.
 */
export async function selectBrandQuerySet(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ queries: string[]; contributingPromptSetIds: string[] }> {
  const rows = await db
    .selectDistinct({
      q: lowerTrimInterpolatedPrompt,
      promptSetId: modelRun.promptSetId,
    })
    .from(modelRunResult)
    .innerJoin(modelRun, eq(modelRun.id, modelRunResult.modelRunId))
    .innerJoin(promptSet, eq(promptSet.id, modelRun.promptSetId))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.brandId, brandId),
        isNull(promptSet.deletedAt),
        gte(modelRunResult.createdAt, new Date(`${periodStart}T00:00:00.000Z`)),
        lte(modelRunResult.createdAt, new Date(`${periodEnd}T23:59:59.999Z`))
      )
    );

  const queries = Array.from(new Set(rows.map((r) => r.q).filter((q): q is string => !!q)));
  const contributingPromptSetIds = Array.from(
    new Set(rows.map((r) => r.promptSetId).filter((id): id is string => !!id))
  );
  return { queries, contributingPromptSetIds };
}

/** Drizzle `inArray` condition for `lower(trim(gsc_query_performance.query))`. */
export function gscQueryInSet(queries: string[]) {
  return inArray(lowerTrimGscQuery, queries);
}
