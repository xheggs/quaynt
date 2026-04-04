import { eq, and, gte, lte, desc, sql, ne, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recommendationShare } from './recommendation-share.schema';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { paginationConfig } from '@/lib/db/query-helpers';
import type {
  BenchmarkFilters,
  BenchmarkResult,
  BrandBenchmark,
  PlatformBenchmark,
  PresenceMatrixFilters,
  PresenceMatrixRow,
} from './benchmark.types';

const ALL_SENTINEL = '_all';

export const BENCHMARK_ALLOWED_SORTS = [
  'rank',
  'recommendationShare',
  'citationCount',
  'brandName',
];

interface AggregateRow {
  brandId: string;
  brandName: string;
  citationCount: number;
  totalCitations: number;
  sharePercentage: string;
  modelRunCount: number;
}

interface PlatformRow {
  brandId: string;
  platformId: string;
  citationCount: number;
  totalCitations: number;
  sharePercentage: string;
}

function resolveDefaults(filters: BenchmarkFilters) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  let to = filters.to;
  let from = filters.from;

  if (from && !to) to = todayStr;
  if (to && !from) {
    const d = new Date(to);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().slice(0, 10);
  }
  if (!from && !to) {
    to = todayStr;
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().slice(0, 10);
  }

  return {
    promptSetId: filters.promptSetId,
    platformId: filters.platformId ?? ALL_SENTINEL,
    locale: filters.locale ?? ALL_SENTINEL,
    from: from!,
    to: to!,
    brandIds: filters.brandIds,
    comparisonPeriod: filters.comparisonPeriod ?? 'previous_period',
  };
}

function computeComparisonDates(
  from: string,
  to: string,
  mode: 'previous_period' | 'previous_week' | 'previous_month'
): { compFrom: string; compTo: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  switch (mode) {
    case 'previous_period': {
      const spanMs = toDate.getTime() - fromDate.getTime();
      const compEnd = new Date(fromDate.getTime() - 86_400_000);
      const compStart = new Date(compEnd.getTime() - spanMs);
      return {
        compFrom: compStart.toISOString().slice(0, 10),
        compTo: compEnd.toISOString().slice(0, 10),
      };
    }
    case 'previous_week':
      return {
        compFrom: shiftDays(from, -7),
        compTo: shiftDays(to, -7),
      };
    case 'previous_month': {
      const cf = new Date(from);
      cf.setMonth(cf.getMonth() - 1);
      clampDay(cf, fromDate);
      const ct = new Date(to);
      ct.setMonth(ct.getMonth() - 1);
      clampDay(ct, toDate);
      return {
        compFrom: cf.toISOString().slice(0, 10),
        compTo: ct.toISOString().slice(0, 10),
      };
    }
  }
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function clampDay(shifted: Date, original: Date): void {
  if (shifted.getDate() !== original.getDate()) {
    shifted.setDate(0); // last day of previous month
  }
}

function getDirection(delta: string | null): 'up' | 'down' | 'stable' | null {
  if (delta === null) return null;
  const val = parseFloat(delta);
  if (val > 0) return 'up';
  if (val < 0) return 'down';
  return 'stable';
}

async function queryShareAggregate(
  workspaceId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  from: string,
  to: string,
  brandIds?: string[]
): Promise<AggregateRow[]> {
  const conditions: SQL[] = [
    eq(recommendationShare.workspaceId, workspaceId),
    eq(recommendationShare.promptSetId, promptSetId),
    eq(recommendationShare.platformId, platformId),
    eq(recommendationShare.locale, locale),
    gte(recommendationShare.periodStart, from),
    lte(recommendationShare.periodStart, to),
  ];

  if (brandIds?.length) {
    conditions.push(inArray(recommendationShare.brandId, brandIds));
  }

  return db
    .select({
      brandId: recommendationShare.brandId,
      brandName: brand.name,
      citationCount: sql<number>`SUM(${recommendationShare.citationCount})::int`.as(
        'citation_count'
      ),
      totalCitations: sql<number>`SUM(${recommendationShare.totalCitations})::int`.as(
        'total_citations'
      ),
      sharePercentage: sql<string>`CASE WHEN SUM(${recommendationShare.totalCitations}) > 0
        THEN ROUND(SUM(${recommendationShare.citationCount})::numeric / SUM(${recommendationShare.totalCitations}) * 100, 2)::text
        ELSE '0.00' END`.as('share_percentage'),
      modelRunCount: sql<number>`SUM(${recommendationShare.modelRunCount})::int`.as(
        'model_run_count'
      ),
    })
    .from(recommendationShare)
    .innerJoin(brand, eq(recommendationShare.brandId, brand.id))
    .where(and(...conditions))
    .groupBy(recommendationShare.brandId, brand.name)
    .orderBy(desc(sql`share_percentage`));
}

async function queryPlatformBreakdown(
  workspaceId: string,
  promptSetId: string,
  locale: string,
  from: string,
  to: string,
  brandIds?: string[]
): Promise<PlatformRow[]> {
  const conditions: SQL[] = [
    eq(recommendationShare.workspaceId, workspaceId),
    eq(recommendationShare.promptSetId, promptSetId),
    ne(recommendationShare.platformId, ALL_SENTINEL),
    eq(recommendationShare.locale, locale),
    gte(recommendationShare.periodStart, from),
    lte(recommendationShare.periodStart, to),
  ];

  if (brandIds?.length) {
    conditions.push(inArray(recommendationShare.brandId, brandIds));
  }

  return db
    .select({
      brandId: recommendationShare.brandId,
      platformId: recommendationShare.platformId,
      citationCount: sql<number>`SUM(${recommendationShare.citationCount})::int`.as(
        'citation_count'
      ),
      totalCitations: sql<number>`SUM(${recommendationShare.totalCitations})::int`.as(
        'total_citations'
      ),
      sharePercentage: sql<string>`CASE WHEN SUM(${recommendationShare.totalCitations}) > 0
        THEN ROUND(SUM(${recommendationShare.citationCount})::numeric / SUM(${recommendationShare.totalCitations}) * 100, 2)::text
        ELSE '0.00' END`.as('share_percentage'),
    })
    .from(recommendationShare)
    .where(and(...conditions))
    .groupBy(recommendationShare.brandId, recommendationShare.platformId);
}

export async function getBenchmarks(
  workspaceId: string,
  filters: BenchmarkFilters
): Promise<BenchmarkResult> {
  const resolved = resolveDefaults(filters);
  const { compFrom, compTo } = computeComparisonDates(
    resolved.from,
    resolved.to,
    resolved.comparisonPeriod
  );

  // Fetch current period, comparison period, and prompt set name in parallel
  const [currentRows, comparisonRows, promptSetRow] = await Promise.all([
    queryShareAggregate(
      workspaceId,
      resolved.promptSetId,
      resolved.platformId,
      resolved.locale,
      resolved.from,
      resolved.to,
      resolved.brandIds
    ),
    queryShareAggregate(
      workspaceId,
      resolved.promptSetId,
      resolved.platformId,
      resolved.locale,
      compFrom,
      compTo,
      resolved.brandIds
    ),
    db
      .select({ name: promptSet.name })
      .from(promptSet)
      .where(eq(promptSet.id, resolved.promptSetId))
      .limit(1),
  ]);

  // Build comparison lookup and assign comparison ranks
  const compMap = new Map<
    string,
    { sharePercentage: string; citationCount: number; rank: number }
  >();
  comparisonRows.forEach((row, i) => {
    compMap.set(row.brandId, {
      sharePercentage: row.sharePercentage,
      citationCount: row.citationCount,
      rank: i + 1,
    });
  });

  // Build brand benchmarks with ranks and deltas
  const brands: BrandBenchmark[] = currentRows.map((row, i) => {
    const rank = i + 1;
    const prev = compMap.get(row.brandId);
    const shareDelta = prev
      ? (parseFloat(row.sharePercentage) - parseFloat(prev.sharePercentage)).toFixed(2)
      : null;
    const citDelta = prev ? row.citationCount - prev.citationCount : null;
    const rankChange = prev ? prev.rank - rank : null;

    return {
      brandId: row.brandId,
      brandName: row.brandName,
      rank,
      rankChange,
      recommendationShare: {
        current: row.sharePercentage,
        previous: prev?.sharePercentage ?? null,
        delta: shareDelta,
        direction: getDirection(shareDelta),
      },
      citationCount: {
        current: row.citationCount,
        previous: prev?.citationCount ?? null,
        delta: citDelta,
      },
      modelRunCount: row.modelRunCount,
    };
  });

  // Platform breakdown when no specific platformId filter
  if (!filters.platformId && brands.length > 0) {
    const platformRows = await queryPlatformBreakdown(
      workspaceId,
      resolved.promptSetId,
      resolved.locale,
      resolved.from,
      resolved.to,
      resolved.brandIds
    );

    const platformMap = new Map<string, PlatformBenchmark[]>();
    for (const row of platformRows) {
      const arr = platformMap.get(row.brandId) ?? [];
      arr.push({
        platformId: row.platformId,
        sharePercentage: row.sharePercentage,
        delta: null, // platform-level delta deferred to keep query count bounded
        citationCount: row.citationCount,
      });
      platformMap.set(row.brandId, arr);
    }

    for (const b of brands) {
      b.platformBreakdown = platformMap.get(b.brandId) ?? [];
    }
  }

  // Count total prompts in this prompt set
  const [promptCountResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(prompt)
    .where(eq(prompt.promptSetId, resolved.promptSetId));

  // Get last updated timestamp
  const [latestRow] = await db
    .select({ updatedAt: recommendationShare.updatedAt })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, resolved.promptSetId)
      )
    )
    .orderBy(desc(recommendationShare.updatedAt))
    .limit(1);

  return {
    market: {
      promptSetId: resolved.promptSetId,
      name: promptSetRow[0]?.name ?? '',
    },
    period: {
      from: resolved.from,
      to: resolved.to,
      comparisonFrom: compFrom,
      comparisonTo: compTo,
    },
    brands,
    meta: {
      totalBrands: brands.length,
      totalPrompts: promptCountResult?.count ?? 0,
      lastUpdatedAt: latestRow?.updatedAt?.toISOString() ?? null,
    },
  };
}

export async function getPresenceMatrix(
  workspaceId: string,
  filters: PresenceMatrixFilters,
  pagination: { page: number; limit: number }
): Promise<{ rows: PresenceMatrixRow[]; total: number }> {
  const conditions: SQL[] = [
    eq(modelRun.workspaceId, workspaceId),
    eq(modelRun.promptSetId, filters.promptSetId),
  ];

  if (filters.brandIds?.length) {
    conditions.push(inArray(citation.brandId, filters.brandIds));
  }
  if (filters.platformId) {
    conditions.push(eq(citation.platformId, filters.platformId));
  }
  if (filters.from) {
    conditions.push(gte(modelRun.startedAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(modelRun.startedAt, new Date(filters.to)));
  }

  // Query flat rows grouped by (promptId, brandId)
  const flatRows = await db
    .select({
      promptId: prompt.id,
      promptText: prompt.template,
      brandId: citation.brandId,
      brandName: brand.name,
      citationCount: sql<number>`COUNT(${citation.id})::int`.as('citation_count'),
    })
    .from(citation)
    .innerJoin(modelRunResult, eq(citation.modelRunResultId, modelRunResult.id))
    .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
    .innerJoin(prompt, eq(modelRunResult.promptId, prompt.id))
    .innerJoin(brand, eq(citation.brandId, brand.id))
    .where(and(...conditions))
    .groupBy(prompt.id, prompt.template, citation.brandId, brand.name)
    .orderBy(desc(sql`citation_count`));

  // Pivot into matrix rows: one row per prompt
  const promptMap = new Map<string, PresenceMatrixRow>();
  for (const row of flatRows) {
    let matrixRow = promptMap.get(row.promptId);
    if (!matrixRow) {
      matrixRow = {
        promptId: row.promptId,
        promptText: row.promptText,
        brands: [],
      };
      promptMap.set(row.promptId, matrixRow);
    }
    matrixRow.brands.push({
      brandId: row.brandId,
      brandName: row.brandName,
      present: true,
      citationCount: row.citationCount,
    });
  }

  // Sort prompts by total citations descending
  const allRows = Array.from(promptMap.values()).sort((a, b) => {
    const totalA = a.brands.reduce((sum, br) => sum + br.citationCount, 0);
    const totalB = b.brands.reduce((sum, br) => sum + br.citationCount, 0);
    return totalB - totalA;
  });

  const total = allRows.length;
  const { limit, offset } = paginationConfig(pagination);
  const paged = allRows.slice(offset, offset + limit);

  return { rows: paged, total };
}
