// ---------------------------------------------------------------------------
// GSC correlation service.
//
// The join key is the *query text* itself:
//   gsc_query_performance.query ↔ model_run_result.interpolated_prompt
// filtered to citations where `citation.platformId = 'aio'` and
// `citation.workspaceId = :workspaceId`.
//
// Matching is case-insensitive + trimmed since AIO-adapter prompts are
// keyword-style and GSC queries are lowercased by Google, but users may
// configure prompts with any casing. Exact text matching is the honest
// behaviour — if a prompt is phrased differently from the GSC query it
// simply won't correlate.
// ---------------------------------------------------------------------------

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { gscQueryPerformance } from './gsc-query-performance.schema';
import { listConnections } from '@/modules/integrations/gsc/gsc-connection.service';
import type { GscConnectionPublic } from '@/modules/integrations/gsc/gsc-connection.service';
import {
  lowerTrimGscQuery,
  lowerTrimInterpolatedPrompt,
  selectAiCitedQueriesForWorkspace,
} from './query-set';

const AIO_PLATFORM_ID = 'aio';

export interface CorrelationFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  propertyUrl?: string;
}

export interface CorrelationSummary {
  aiCitedClicks: number;
  aiCitedImpressions: number;
  avgPosition: number | null; // impression-weighted
  distinctQueries: number;
  gapQueries: number; // AI-cited but no GSC data
}

export interface CorrelationTimeSeriesPoint {
  date: string;
  aiCitedClicks: number;
  aiCitedImpressions: number;
  allClicks: number;
  allImpressions: number;
}

export interface TopAiCitedQueryEntry {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  aiCitationCount: number;
  firstDetectedAt: Date | null;
}

export interface TopAiCitedQueriesPage {
  items: TopAiCitedQueryEntry[];
  total: number;
}

function baseGscConditions(workspaceId: string, f: CorrelationFilters): SQL[] {
  const conds: SQL[] = [
    eq(gscQueryPerformance.workspaceId, workspaceId),
    gte(gscQueryPerformance.date, f.from),
    lte(gscQueryPerformance.date, f.to),
  ];
  if (f.propertyUrl) {
    conds.push(eq(gscQueryPerformance.propertyUrl, f.propertyUrl));
  }
  return conds;
}

// The workspace-scoped AI-cited query selector lives in ./query-set.ts and is
// re-used by 6.5a's SEO score (with a brand-scoped sibling helper). The inline
// alias below keeps the call sites below unchanged.
const getAiCitedQueries = selectAiCitedQueriesForWorkspace;

export async function getCorrelationSummary(
  workspaceId: string,
  filters: CorrelationFilters
): Promise<CorrelationSummary> {
  const aiCitedQueries = await getAiCitedQueries(workspaceId, filters.from, filters.to);

  if (aiCitedQueries.length === 0) {
    return {
      aiCitedClicks: 0,
      aiCitedImpressions: 0,
      avgPosition: null,
      distinctQueries: 0,
      gapQueries: 0,
    };
  }

  const gscConds = [
    ...baseGscConditions(workspaceId, filters),
    inArray(lowerTrimGscQuery, aiCitedQueries),
  ];

  const [agg] = await db
    .select({
      totalClicks: sql<number>`coalesce(sum(${gscQueryPerformance.clicks}), 0)`,
      totalImpressions: sql<number>`coalesce(sum(${gscQueryPerformance.impressions}), 0)`,
      weightedPositionNumerator: sql<number>`coalesce(sum(${gscQueryPerformance.position} * ${gscQueryPerformance.impressions}), 0)`,
      distinctQueries: sql<number>`count(distinct ${lowerTrimGscQuery})`,
    })
    .from(gscQueryPerformance)
    .where(and(...gscConds));

  const totalImpressions = Number(agg?.totalImpressions ?? 0);
  const avgPosition =
    totalImpressions > 0 ? Number(agg.weightedPositionNumerator) / totalImpressions : null;

  const matched = Number(agg?.distinctQueries ?? 0);
  const gapQueries = Math.max(0, aiCitedQueries.length - matched);

  return {
    aiCitedClicks: Number(agg?.totalClicks ?? 0),
    aiCitedImpressions: totalImpressions,
    avgPosition,
    distinctQueries: matched,
    gapQueries,
  };
}

export async function getCorrelationTimeSeries(
  workspaceId: string,
  filters: CorrelationFilters
): Promise<CorrelationTimeSeriesPoint[]> {
  const aiCitedQueries = await getAiCitedQueries(workspaceId, filters.from, filters.to);
  const baseConds = baseGscConditions(workspaceId, filters);

  // Overall per-day totals
  const allRows = await db
    .select({
      date: gscQueryPerformance.date,
      clicks: sql<number>`sum(${gscQueryPerformance.clicks})`,
      impressions: sql<number>`sum(${gscQueryPerformance.impressions})`,
    })
    .from(gscQueryPerformance)
    .where(and(...baseConds))
    .groupBy(gscQueryPerformance.date)
    .orderBy(gscQueryPerformance.date);

  // AI-cited subset per-day
  let aiRowsMap = new Map<string, { clicks: number; impressions: number }>();
  if (aiCitedQueries.length > 0) {
    const aiRows = await db
      .select({
        date: gscQueryPerformance.date,
        clicks: sql<number>`sum(${gscQueryPerformance.clicks})`,
        impressions: sql<number>`sum(${gscQueryPerformance.impressions})`,
      })
      .from(gscQueryPerformance)
      .where(and(...baseConds, inArray(lowerTrimGscQuery, aiCitedQueries)))
      .groupBy(gscQueryPerformance.date)
      .orderBy(gscQueryPerformance.date);

    aiRowsMap = new Map(
      aiRows.map((r) => [r.date, { clicks: Number(r.clicks), impressions: Number(r.impressions) }])
    );
  }

  return allRows.map((r) => {
    const ai = aiRowsMap.get(r.date) ?? { clicks: 0, impressions: 0 };
    return {
      date: r.date,
      aiCitedClicks: ai.clicks,
      aiCitedImpressions: ai.impressions,
      allClicks: Number(r.clicks),
      allImpressions: Number(r.impressions),
    };
  });
}

export async function getTopAiCitedQueries(
  workspaceId: string,
  filters: CorrelationFilters,
  pagination: { page: number; limit: number }
): Promise<TopAiCitedQueriesPage> {
  const aiCitedQueries = await getAiCitedQueries(workspaceId, filters.from, filters.to);
  if (aiCitedQueries.length === 0) return { items: [], total: 0 };

  const offset = (pagination.page - 1) * pagination.limit;

  const gscConds = [
    ...baseGscConditions(workspaceId, filters),
    inArray(lowerTrimGscQuery, aiCitedQueries),
  ];

  // Aggregate GSC per normalized query.
  const gscRows = await db
    .select({
      queryNorm: lowerTrimGscQuery,
      clicks: sql<number>`sum(${gscQueryPerformance.clicks})`,
      impressions: sql<number>`sum(${gscQueryPerformance.impressions})`,
      weightedPositionNumerator: sql<number>`sum(${gscQueryPerformance.position} * ${gscQueryPerformance.impressions})`,
      totalImpressionsForAvg: sql<number>`sum(${gscQueryPerformance.impressions})`,
    })
    .from(gscQueryPerformance)
    .where(and(...gscConds))
    .groupBy(lowerTrimGscQuery)
    .orderBy(desc(sql`sum(${gscQueryPerformance.clicks})`))
    .limit(pagination.limit)
    .offset(offset);

  const total = aiCitedQueries.length;

  if (gscRows.length === 0) return { items: [], total };

  // Fetch AIO citation counts + earliest createdAt for the matched normalized queries.
  const matchedQueries = gscRows.map((r) => r.queryNorm);
  const citationRows = await db
    .select({
      queryNorm: lowerTrimInterpolatedPrompt,
      count: sql<number>`count(*)::int`,
      firstDetectedAt: sql<Date>`min(${citation.createdAt})`,
    })
    .from(citation)
    .innerJoin(modelRunResult, eq(modelRunResult.id, citation.modelRunResultId))
    .where(
      and(
        eq(citation.workspaceId, workspaceId),
        eq(citation.platformId, AIO_PLATFORM_ID),
        inArray(lowerTrimInterpolatedPrompt, matchedQueries)
      )
    )
    .groupBy(lowerTrimInterpolatedPrompt);

  const citationMap = new Map(
    citationRows.map((r) => [
      r.queryNorm,
      { count: Number(r.count), firstDetectedAt: r.firstDetectedAt },
    ])
  );

  return {
    items: gscRows.map((r) => {
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const position =
        Number(r.totalImpressionsForAvg) > 0
          ? Number(r.weightedPositionNumerator) / Number(r.totalImpressionsForAvg)
          : 0;
      const c = citationMap.get(r.queryNorm);
      return {
        query: r.queryNorm,
        clicks,
        impressions,
        ctr,
        position,
        aiCitationCount: c?.count ?? 0,
        firstDetectedAt: c?.firstDetectedAt ?? null,
      };
    }),
    total,
  };
}

export async function getConnectedProperties(workspaceId: string): Promise<GscConnectionPublic[]> {
  return listConnections(workspaceId);
}

// Re-export for API routes that need the connection type but don't directly import the service.
export type { GscConnectionPublic };
