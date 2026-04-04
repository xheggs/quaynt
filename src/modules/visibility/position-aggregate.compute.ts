import { and, eq, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { positionAggregate } from './position-aggregate.schema';
import type { PositionAggregateComputeInput } from './position-aggregate.types';
import { logger } from '@/lib/logger';

const ALL_SENTINEL = '_all';

interface PositionCitationGroup {
  brandId: string;
  platformId: string;
  locale: string;
  positions: number[];
  modelRunIds: string[];
}

interface PositionMetrics {
  citationCount: number;
  averagePosition: string;
  medianPosition: string;
  minPosition: number;
  maxPosition: number;
  firstMentionCount: number;
  firstMentionRate: string;
  topThreeCount: number;
  topThreeRate: string;
  positionDistribution: Record<string, number>;
}

interface PositionAggregateRow {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  citationCount: number;
  averagePosition: string;
  medianPosition: string;
  minPosition: number;
  maxPosition: number;
  firstMentionCount: number;
  firstMentionRate: string;
  topThreeCount: number;
  topThreeRate: string;
  positionDistribution: Record<string, number>;
  modelRunCount: number;
}

/**
 * Computes position metrics from an array of ordinal positions.
 * Pure function — no side effects, safe for unit testing.
 */
export function computePositionMetrics(positions: number[]): PositionMetrics {
  const count = positions.length;
  const sorted = [...positions].sort((a, b) => a - b);

  const sum = positions.reduce((acc, p) => acc + p, 0);
  const averagePosition = (sum / count).toFixed(2);

  // Median: for even-length arrays, average the two middle values
  let median: number;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }
  const medianPosition = median.toFixed(2);

  const minPosition = sorted[0];
  const maxPosition = sorted[count - 1];

  const firstMentionCount = positions.filter((p) => p === 1).length;
  const firstMentionRate = ((firstMentionCount / count) * 100).toFixed(2);

  const topThreeCount = positions.filter((p) => p <= 3).length;
  const topThreeRate = ((topThreeCount / count) * 100).toFixed(2);

  const positionDistribution: Record<string, number> = {};
  for (const p of positions) {
    const key = String(p);
    positionDistribution[key] = (positionDistribution[key] ?? 0) + 1;
  }

  return {
    citationCount: count,
    averagePosition,
    medianPosition,
    minPosition,
    maxPosition,
    firstMentionCount,
    firstMentionRate,
    topThreeCount,
    topThreeRate,
    positionDistribution,
  };
}

/**
 * Computes position aggregates for a workspace/promptSet/date combination.
 * Idempotent: re-running produces the same result via upsert.
 */
export async function computePositionAggregate(
  input: PositionAggregateComputeInput
): Promise<{ changed: boolean }> {
  const { workspaceId, promptSetId, date } = input;
  const log = logger.child({ workspaceId, promptSetId, date });

  const groups = await fetchPositionGroups(workspaceId, promptSetId, date);

  if (groups.length === 0) {
    log.info('No citations found for position aggregate computation');
    return { changed: false };
  }

  const rows = expandPositionAggregates(groups, workspaceId, promptSetId, date);

  if (rows.length === 0) {
    return { changed: false };
  }

  const changed = await upsertPositionRows(rows);

  log.info({ rowCount: rows.length, changed }, 'Position aggregate computation complete');

  return { changed };
}

async function fetchPositionGroups(
  workspaceId: string,
  promptSetId: string,
  date: string
): Promise<PositionCitationGroup[]> {
  const results = await db
    .select({
      brandId: citation.brandId,
      platformId: citation.platformId,
      locale: sql<string>`COALESCE(${citation.locale}, ${ALL_SENTINEL})`.as('locale'),
      positions: sql<number[]>`array_agg(${citation.position})`.as('positions'),
      modelRunIds: sql<string[]>`array_agg(DISTINCT ${citation.modelRunId})`.as('model_run_ids'),
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

  return results as PositionCitationGroup[];
}

/**
 * Expands fine-grained position groups into 4-level aggregation rows per brand.
 * Critical: rolled-up levels concatenate raw position arrays before computing metrics
 * (median of medians ≠ median of all values).
 */
export function expandPositionAggregates(
  groups: PositionCitationGroup[],
  workspaceId: string,
  promptSetId: string,
  date: string
): PositionAggregateRow[] {
  // Accumulate positions and modelRunIds at each aggregation level
  type Bucket = { positions: number[]; modelRunIds: Set<string> };

  const buckets = new Map<string, Bucket>();

  function getBucket(key: string): Bucket {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { positions: [], modelRunIds: new Set() };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function addToBucket(bucket: Bucket, positions: number[], modelRunIds: string[]) {
    bucket.positions.push(...positions);
    for (const id of modelRunIds) {
      bucket.modelRunIds.add(id);
    }
  }

  for (const group of groups) {
    const { brandId, platformId, locale, positions, modelRunIds } = group;

    // Level 1: (brand, platform, locale)
    addToBucket(getBucket(`${brandId}:${platformId}:${locale}`), positions, modelRunIds);
    // Level 2: (brand, platform, '_all')
    addToBucket(getBucket(`${brandId}:${platformId}:${ALL_SENTINEL}`), positions, modelRunIds);
    // Level 3: (brand, '_all', locale)
    addToBucket(getBucket(`${brandId}:${ALL_SENTINEL}:${locale}`), positions, modelRunIds);
    // Level 4: (brand, '_all', '_all')
    addToBucket(getBucket(`${brandId}:${ALL_SENTINEL}:${ALL_SENTINEL}`), positions, modelRunIds);
  }

  const rows: PositionAggregateRow[] = [];

  for (const [key, bucket] of buckets) {
    if (bucket.positions.length === 0) continue;

    const [brandId, platformId, locale] = key.split(':');
    const metrics = computePositionMetrics(bucket.positions);

    rows.push({
      workspaceId,
      promptSetId,
      brandId,
      platformId,
      locale,
      periodStart: date,
      ...metrics,
      modelRunCount: bucket.modelRunIds.size,
    });
  }

  return rows;
}

async function upsertPositionRows(rows: PositionAggregateRow[]): Promise<boolean> {
  const result = await db
    .insert(positionAggregate)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        positionAggregate.workspaceId,
        positionAggregate.promptSetId,
        positionAggregate.brandId,
        positionAggregate.platformId,
        positionAggregate.locale,
        positionAggregate.periodStart,
      ],
      set: {
        citationCount: sql`excluded.citation_count`,
        averagePosition: sql`excluded.average_position`,
        medianPosition: sql`excluded.median_position`,
        minPosition: sql`excluded.min_position`,
        maxPosition: sql`excluded.max_position`,
        firstMentionCount: sql`excluded.first_mention_count`,
        firstMentionRate: sql`excluded.first_mention_rate`,
        topThreeCount: sql`excluded.top_three_count`,
        topThreeRate: sql`excluded.top_three_rate`,
        positionDistribution: sql`excluded.position_distribution`,
        modelRunCount: sql`excluded.model_run_count`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: positionAggregate.id,
    });

  return result.length > 0;
}
