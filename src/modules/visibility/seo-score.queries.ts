/**
 * SEO Score read/trend operations. Split out of seo-score.service to keep
 * the service under the module-size cap while preserving the stable import
 * path `@/modules/visibility/seo-score.service` (which re-exports these).
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { seoScoreSnapshot } from './seo-score-snapshot.schema';
import { computeDelta, computeEWMA, computeOverallDirection } from './trend.stats';
import type {
  DataQualityAdvisory,
  Granularity,
  SeoFactorResult,
  SeoScoreCode,
} from './seo-score.types';

const ALL = '_all';

export interface SeoSnapshotRow {
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
  querySetSize: number;
  dataQualityAdvisories: DataQualityAdvisory[];
  code: SeoScoreCode | null;
  factors: SeoFactorResult[];
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
  querySetSize: number;
  dataQualityAdvisories: string[];
  code: string | null;
  factors: unknown;
  computedAt: Date;
}): SeoSnapshotRow {
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
    querySetSize: row.querySetSize,
    dataQualityAdvisories: row.dataQualityAdvisories as DataQualityAdvisory[],
    code: (row.code as SeoScoreCode | null) ?? null,
    factors: row.factors as SeoFactorResult[],
    computedAt: row.computedAt,
  };
}

const SNAPSHOT_COLUMNS = {
  id: seoScoreSnapshot.id,
  periodStart: seoScoreSnapshot.periodStart,
  periodEnd: seoScoreSnapshot.periodEnd,
  granularity: seoScoreSnapshot.granularity,
  platformId: seoScoreSnapshot.platformId,
  locale: seoScoreSnapshot.locale,
  composite: seoScoreSnapshot.composite,
  compositeRaw: seoScoreSnapshot.compositeRaw,
  displayCapApplied: seoScoreSnapshot.displayCapApplied,
  formulaVersion: seoScoreSnapshot.formulaVersion,
  contributingPromptSetIds: seoScoreSnapshot.contributingPromptSetIds,
  querySetSize: seoScoreSnapshot.querySetSize,
  dataQualityAdvisories: seoScoreSnapshot.dataQualityAdvisories,
  code: seoScoreSnapshot.code,
  factors: seoScoreSnapshot.factors,
  computedAt: seoScoreSnapshot.computedAt,
};

export async function getLatestSnapshot(
  workspaceId: string,
  brandId: string,
  granularity: Granularity,
  platformId: string = ALL,
  locale: string = ALL
): Promise<SeoSnapshotRow | null> {
  const [row] = await db
    .select(SNAPSHOT_COLUMNS)
    .from(seoScoreSnapshot)
    .where(
      and(
        eq(seoScoreSnapshot.workspaceId, workspaceId),
        eq(seoScoreSnapshot.brandId, brandId),
        eq(seoScoreSnapshot.granularity, granularity),
        eq(seoScoreSnapshot.platformId, platformId),
        eq(seoScoreSnapshot.locale, locale)
      )
    )
    .orderBy(desc(seoScoreSnapshot.periodStart))
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
): Promise<SeoSnapshotRow[]> {
  const rows = await db
    .select(SNAPSHOT_COLUMNS)
    .from(seoScoreSnapshot)
    .where(
      and(
        eq(seoScoreSnapshot.workspaceId, workspaceId),
        eq(seoScoreSnapshot.brandId, brandId),
        eq(seoScoreSnapshot.granularity, granularity),
        eq(seoScoreSnapshot.platformId, platformId),
        eq(seoScoreSnapshot.locale, locale),
        gte(seoScoreSnapshot.periodStart, from),
        lte(seoScoreSnapshot.periodStart, to)
      )
    )
    .orderBy(seoScoreSnapshot.periodStart);

  return rows.map(mapSnapshot);
}

export interface SeoTrendStats {
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
  snapshots: SeoSnapshotRow[];
  trend: SeoTrendStats;
  formulaVersionChanges: Array<{
    periodStart: string;
    fromVersion: number;
    toVersion: number;
  }>;
}> {
  const snapshots = await listSnapshots(workspaceId, brandId, from, to, granularity);

  const composites = snapshots.map((s) => s.composite).filter((v): v is number => v !== null);

  if (composites.length === 0) {
    return {
      snapshots,
      trend: {
        delta: null,
        changeRate: null,
        direction: null,
        ewma: [],
        overallDirection: null,
      },
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

function detectFormulaVersionChanges(snapshots: SeoSnapshotRow[]): Array<{
  periodStart: string;
  fromVersion: number;
  toVersion: number;
}> {
  const changes: Array<{
    periodStart: string;
    fromVersion: number;
    toVersion: number;
  }> = [];
  for (let i = 1; i < snapshots.length; i += 1) {
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
