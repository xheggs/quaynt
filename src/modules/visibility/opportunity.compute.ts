import { and, eq, sql, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { brand } from '@/modules/brands/brand.schema';
import { opportunity } from './opportunity.schema';
import type { OpportunityComputeInput, OpportunityType } from './opportunity.types';
import { logger } from '@/lib/logger';

interface PresenceEntry {
  citationCount: number;
  platforms: Map<string, number>; // platformId → citationCount
}

interface OpportunityUpsertRow {
  workspaceId: string;
  brandId: string;
  promptSetId: string;
  promptId: string;
  periodStart: string;
  type: OpportunityType;
  score: string;
  competitorCount: number;
  totalTrackedBrands: number;
  platformCount: number;
  brandCitationCount: number;
  competitors: { brandId: string; brandName: string; citationCount: number }[];
  platformBreakdown: { platformId: string; brandGapOnPlatform: boolean; competitorCount: number }[];
}

/**
 * Computes the composite opportunity score (0-80).
 * Exported for unit testing.
 */
export function computeOpportunityScore(
  competitorCount: number,
  totalTrackedBrands: number,
  platformCount: number,
  totalPlatforms: number,
  type: OpportunityType
): number {
  const competitorDensity =
    totalTrackedBrands > 0 ? (competitorCount / totalTrackedBrands) * 50 : 0;
  const platformBreadth = totalPlatforms > 0 ? (platformCount / totalPlatforms) * 30 : 0;
  const typePenalty = type === 'missing' ? 1.0 : 0.7;
  return Math.round((competitorDensity + platformBreadth) * typePenalty);
}

/**
 * Computes the median of a numeric array.
 * For even-length arrays, returns the lower of the two middle values
 * (conservative threshold — brand must be strictly below median to be "weak").
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  // For even: use lower-middle for a conservative threshold
  return sorted[mid - 1];
}

/**
 * Computes opportunities for a workspace/promptSet/date combination.
 * Idempotent: re-running produces the same result via upsert + stale cleanup.
 *
 * Returns { changed, opportunityCount }.
 */
export async function computeOpportunities(
  input: OpportunityComputeInput
): Promise<{ changed: boolean; opportunityCount: number }> {
  const { workspaceId, promptSetId, date } = input;
  const log = logger.child({ workspaceId, promptSetId, date });

  // 1. Fetch prompt-level presence data grouped by (promptId, brandId, platformId)
  const presenceData = await fetchPresenceData(workspaceId, promptSetId, date);

  if (presenceData.length === 0) {
    log.info('No citation data found for opportunity computation');
    return { changed: false, opportunityCount: 0 };
  }

  // 2. Fetch all promptIds in the prompt set
  const allPromptIds = await fetchPromptIds(promptSetId);

  if (allPromptIds.length === 0) {
    log.info('No prompts found in prompt set');
    return { changed: false, opportunityCount: 0 };
  }

  // 3. Build in-memory presence map and collect brand names
  const presenceMap = new Map<string, Map<string, PresenceEntry>>();
  const brandNames = new Map<string, string>();
  const allPlatforms = new Set<string>();

  for (const row of presenceData) {
    if (!presenceMap.has(row.promptId)) {
      presenceMap.set(row.promptId, new Map());
    }
    const promptBrands = presenceMap.get(row.promptId)!;

    if (!promptBrands.has(row.brandId)) {
      promptBrands.set(row.brandId, { citationCount: 0, platforms: new Map() });
    }
    const entry = promptBrands.get(row.brandId)!;
    entry.citationCount += row.citationCount;
    entry.platforms.set(
      row.platformId,
      (entry.platforms.get(row.platformId) ?? 0) + row.citationCount
    );

    brandNames.set(row.brandId, row.brandName);
    allPlatforms.add(row.platformId);
  }

  // Tracked brands = all brands that appear in any citation for this prompt set
  const trackedBrandIds = [...brandNames.keys()];
  const totalTrackedBrands = trackedBrandIds.length;
  const totalPlatforms = allPlatforms.size;

  if (totalTrackedBrands < 2) {
    log.info('Fewer than 2 tracked brands — no competitive opportunities to compute');
    return { changed: false, opportunityCount: 0 };
  }

  // 4. Detect opportunities for each brand × prompt
  const rows: OpportunityUpsertRow[] = [];

  for (const brandId of trackedBrandIds) {
    for (const promptIdVal of allPromptIds) {
      const promptBrands = presenceMap.get(promptIdVal);

      // Get this brand's presence on this prompt
      const brandEntry = promptBrands?.get(brandId);
      const brandCitationCount = brandEntry?.citationCount ?? 0;

      // Get competitors (other brands with citations on this prompt)
      const competitors: { brandId: string; brandName: string; citationCount: number }[] = [];
      if (promptBrands) {
        for (const [compId, compEntry] of promptBrands) {
          if (compId !== brandId) {
            competitors.push({
              brandId: compId,
              brandName: brandNames.get(compId) ?? compId,
              citationCount: compEntry.citationCount,
            });
          }
        }
      }

      if (competitors.length === 0) continue;

      // Determine opportunity type
      let type: OpportunityType | null = null;

      if (brandCitationCount === 0) {
        type = 'missing';
      } else {
        // Check if weak: brand citation count below median competitor citation count
        const competitorCounts = competitors.map((c) => c.citationCount);
        const medianCount = median(competitorCounts);
        if (brandCitationCount < medianCount) {
          type = 'weak';
        }
      }

      if (!type) continue;

      // Build platform breakdown
      const platformBreakdown: {
        platformId: string;
        brandGapOnPlatform: boolean;
        competitorCount: number;
      }[] = [];
      let platformGapCount = 0;

      for (const platformId of allPlatforms) {
        const brandPlatformCount = brandEntry?.platforms.get(platformId) ?? 0;

        // Count competitors present on this platform for this prompt
        let platCompCount = 0;
        if (promptBrands) {
          for (const [compId, compEntry] of promptBrands) {
            if (compId !== brandId && (compEntry.platforms.get(platformId) ?? 0) > 0) {
              platCompCount++;
            }
          }
        }

        if (platCompCount === 0) continue; // Skip platforms with no competitor presence on this prompt

        let brandGapOnPlatform: boolean;
        if (type === 'missing') {
          brandGapOnPlatform = brandPlatformCount === 0;
        } else {
          // weak: check per-platform median
          const platCompCounts: number[] = [];
          if (promptBrands) {
            for (const [compId, compEntry] of promptBrands) {
              if (compId !== brandId) {
                const cnt = compEntry.platforms.get(platformId) ?? 0;
                if (cnt > 0) platCompCounts.push(cnt);
              }
            }
          }
          brandGapOnPlatform = brandPlatformCount < median(platCompCounts);
        }

        if (brandGapOnPlatform) platformGapCount++;

        platformBreakdown.push({
          platformId,
          brandGapOnPlatform,
          competitorCount: platCompCount,
        });
      }

      const score = computeOpportunityScore(
        competitors.length,
        totalTrackedBrands,
        platformGapCount,
        totalPlatforms,
        type
      );

      rows.push({
        workspaceId,
        brandId,
        promptSetId,
        promptId: promptIdVal,
        periodStart: date,
        type,
        score: score.toFixed(2),
        competitorCount: competitors.length,
        totalTrackedBrands,
        platformCount: platformGapCount,
        brandCitationCount,
        competitors,
        platformBreakdown,
      });
    }
  }

  if (rows.length === 0) {
    // Clean up any stale rows
    await deleteStaleOpportunities(workspaceId, promptSetId, date, []);
    log.info('No opportunities found');
    return { changed: false, opportunityCount: 0 };
  }

  // 5. Upsert opportunity rows
  const upsertedIds = await upsertOpportunities(rows);

  // 6. Delete stale opportunities (rows that no longer qualify)
  await deleteStaleOpportunities(workspaceId, promptSetId, date, upsertedIds);

  log.info({ opportunityCount: rows.length }, 'Opportunity computation complete');

  return { changed: true, opportunityCount: rows.length };
}

/**
 * Fetches citation presence data grouped by (promptId, brandId, platformId).
 */
async function fetchPresenceData(workspaceId: string, promptSetId: string, date: string) {
  return db
    .select({
      promptId: modelRunResult.promptId,
      brandId: citation.brandId,
      brandName: brand.name,
      platformId: citation.platformId,
      citationCount: sql<number>`COUNT(${citation.id})::int`.as('citation_count'),
    })
    .from(citation)
    .innerJoin(modelRunResult, eq(citation.modelRunResultId, modelRunResult.id))
    .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
    .innerJoin(brand, eq(citation.brandId, brand.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.promptSetId, promptSetId),
        inArray(modelRun.status, ['completed', 'partial']),
        sql`DATE(${modelRun.startedAt} AT TIME ZONE 'UTC') = ${date}`
      )
    )
    .groupBy(modelRunResult.promptId, citation.brandId, brand.name, citation.platformId);
}

/**
 * Fetches all prompt IDs in a prompt set.
 */
async function fetchPromptIds(promptSetId: string): Promise<string[]> {
  const rows = await db
    .select({ id: prompt.id })
    .from(prompt)
    .where(eq(prompt.promptSetId, promptSetId));

  return rows.map((r) => r.id);
}

/**
 * Upserts opportunity rows via onConflictDoUpdate. Returns IDs of upserted rows.
 */
async function upsertOpportunities(rows: OpportunityUpsertRow[]): Promise<string[]> {
  const result = await db
    .insert(opportunity)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        opportunity.workspaceId,
        opportunity.promptSetId,
        opportunity.brandId,
        opportunity.promptId,
        opportunity.periodStart,
      ],
      set: {
        type: sql`excluded.type`,
        score: sql`excluded.score`,
        competitorCount: sql`excluded.competitor_count`,
        totalTrackedBrands: sql`excluded.total_tracked_brands`,
        platformCount: sql`excluded.platform_count`,
        brandCitationCount: sql`excluded.brand_citation_count`,
        competitors: sql`excluded.competitors`,
        platformBreakdown: sql`excluded.platform_breakdown`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: opportunity.id });

  return result.map((r) => r.id);
}

/**
 * Deletes stale opportunity rows — opportunities that no longer qualify after recomputation.
 */
async function deleteStaleOpportunities(
  workspaceId: string,
  promptSetId: string,
  date: string,
  validIds: string[]
): Promise<void> {
  const conditions = [
    eq(opportunity.workspaceId, workspaceId),
    eq(opportunity.promptSetId, promptSetId),
    eq(opportunity.periodStart, date),
  ];

  if (validIds.length > 0) {
    conditions.push(notInArray(opportunity.id, validIds));
  }

  await db.delete(opportunity).where(and(...conditions));
}
