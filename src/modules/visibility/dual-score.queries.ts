/**
 * Dual Score per-query table. Merges GSC impressions/clicks with AIO citation
 * counts and classifies each query's gap signal. Split out of dual-score.service
 * to keep files focused and under the 500-line module cap.
 */

import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { gscQueryPerformance } from '@/modules/integrations/gsc-correlation/gsc-query-performance.schema';
import {
  lowerTrimGscQuery,
  lowerTrimInterpolatedPrompt,
  selectBrandQuerySet,
} from '@/modules/integrations/gsc-correlation/query-set';
import { classifyGapSignal } from './dual-score.formula';
import type { DualQueriesPage, DualQueryRow, GapSignal } from './dual-score.types';

const AIO_PLATFORM_ID = 'aio';

export type DualQuerySortKey = 'impressions' | 'aioCitationCount' | 'avgPosition' | 'gapSignal';

export interface GetDualQueriesOptions {
  pagination: { page: number; limit: number };
  filter?: { gapSignal?: GapSignal };
  sort?: DualQuerySortKey;
}

export async function getDualQueries(
  workspaceId: string,
  brandId: string,
  from: string,
  to: string,
  options: GetDualQueriesOptions
): Promise<DualQueriesPage> {
  const { queries } = await selectBrandQuerySet(workspaceId, brandId, from, to);
  if (queries.length === 0) {
    return emptyPage(options.pagination);
  }

  const gscRows = await db
    .select({
      queryNorm: lowerTrimGscQuery,
      clicks: sql<number>`coalesce(sum(${gscQueryPerformance.clicks}), 0)`,
      impressions: sql<number>`coalesce(sum(${gscQueryPerformance.impressions}), 0)`,
      weightedPositionNumerator: sql<number>`coalesce(sum(${gscQueryPerformance.position} * ${gscQueryPerformance.impressions}), 0)`,
    })
    .from(gscQueryPerformance)
    .where(
      and(
        eq(gscQueryPerformance.workspaceId, workspaceId),
        gte(gscQueryPerformance.date, from),
        lte(gscQueryPerformance.date, to),
        inArray(lowerTrimGscQuery, queries)
      )
    )
    .groupBy(lowerTrimGscQuery);

  const gscMap = new Map<
    string,
    { clicks: number; impressions: number; weightedPositionNumerator: number }
  >();
  for (const r of gscRows) {
    gscMap.set(r.queryNorm, {
      clicks: Number(r.clicks),
      impressions: Number(r.impressions),
      weightedPositionNumerator: Number(r.weightedPositionNumerator),
    });
  }

  const citationRows = await db
    .select({
      queryNorm: lowerTrimInterpolatedPrompt,
      totalCount: sql<number>`count(*)::int`,
      brandCount: sql<number>`count(*) filter (where ${citation.brandId} = ${brandId})::int`,
      brandPositionSum: sql<number>`coalesce(sum(${citation.position}) filter (where ${citation.brandId} = ${brandId}), 0)`,
      brandSentimentSum: sql<number>`coalesce(sum(${citation.sentimentScore}) filter (where ${citation.brandId} = ${brandId} and ${citation.sentimentScore} is not null), 0)`,
      brandSentimentCount: sql<number>`count(*) filter (where ${citation.brandId} = ${brandId} and ${citation.sentimentScore} is not null)::int`,
      firstSeenAt: sql<Date | null>`min(${citation.createdAt})`,
    })
    .from(citation)
    .innerJoin(modelRunResult, eq(modelRunResult.id, citation.modelRunResultId))
    .where(
      and(
        eq(citation.workspaceId, workspaceId),
        eq(citation.platformId, AIO_PLATFORM_ID),
        gte(citation.createdAt, new Date(`${from}T00:00:00.000Z`)),
        lte(citation.createdAt, new Date(`${to}T23:59:59.999Z`)),
        inArray(lowerTrimInterpolatedPrompt, queries)
      )
    )
    .groupBy(lowerTrimInterpolatedPrompt);

  const citationMap = new Map<
    string,
    {
      totalCount: number;
      brandCount: number;
      brandPositionSum: number;
      brandSentimentSum: number;
      brandSentimentCount: number;
      firstSeenAt: Date | null;
    }
  >();
  for (const r of citationRows) {
    citationMap.set(r.queryNorm, {
      totalCount: Number(r.totalCount),
      brandCount: Number(r.brandCount),
      brandPositionSum: Number(r.brandPositionSum),
      brandSentimentSum: Number(r.brandSentimentSum),
      brandSentimentCount: Number(r.brandSentimentCount),
      firstSeenAt: r.firstSeenAt ?? null,
    });
  }

  const mergedRows: DualQueryRow[] = [];
  for (const q of queries) {
    const g = gscMap.get(q);
    const c = citationMap.get(q);
    if (!g && !c) continue;
    const impressions = g?.impressions ?? 0;
    const clicks = g?.clicks ?? 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const avgPosition = impressions > 0 && g ? g.weightedPositionNumerator / impressions : null;
    const aioCitationCount = c?.totalCount ?? 0;
    const brandCount = c?.brandCount ?? 0;
    const brandMentionRate = aioCitationCount > 0 ? brandCount / aioCitationCount : null;
    const avgBrandPosition =
      brandCount > 0 ? (c as NonNullable<typeof c>).brandPositionSum / brandCount : null;
    const netSentimentScore =
      c && c.brandSentimentCount > 0 ? c.brandSentimentSum / c.brandSentimentCount : null;
    const gapSignal = classifyGapSignal({ impressions, aioCitationCount });
    mergedRows.push({
      query: q,
      impressions,
      clicks,
      ctr,
      avgPosition,
      aioCitationCount,
      aioFirstSeenAt: c?.firstSeenAt ? c.firstSeenAt.toISOString() : null,
      brandMentionRate,
      avgBrandPosition,
      netSentimentScore,
      gapSignal,
    });
  }

  const filtered = options.filter?.gapSignal
    ? mergedRows.filter((r) => r.gapSignal === options.filter!.gapSignal)
    : mergedRows;

  sortRows(filtered, options.sort ?? 'impressions');

  const { page, limit } = options.pagination;
  const offset = (page - 1) * limit;
  const slice = filtered.slice(offset, offset + limit);

  return {
    rows: slice,
    page,
    limit,
    totalRows: filtered.length,
    totalPages: limit > 0 ? Math.ceil(filtered.length / limit) : 0,
  };
}

function sortRows(rows: DualQueryRow[], sort: DualQuerySortKey): void {
  if (sort === 'avgPosition') {
    rows.sort((a, b) => (a.avgPosition ?? Infinity) - (b.avgPosition ?? Infinity));
    return;
  }
  if (sort === 'gapSignal') {
    const order: Record<GapSignal, number> = {
      high_seo_no_ai: 0,
      high_ai_no_seo: 1,
      balanced: 2,
      no_signal: 3,
    };
    rows.sort((a, b) => order[a.gapSignal] - order[b.gapSignal]);
    return;
  }
  // Default: largest first for impressions / aioCitationCount.
  rows.sort((a, b) => (b[sort] as number) - (a[sort] as number));
}

function emptyPage(pagination: { page: number; limit: number }): DualQueriesPage {
  return {
    rows: [],
    page: pagination.page,
    limit: pagination.limit,
    totalRows: 0,
    totalPages: 0,
  };
}
