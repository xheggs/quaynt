import { and, eq, sql, isNotNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { sentimentAggregate } from './sentiment-aggregate.schema';
import type { SentimentAggregateComputeInput } from './sentiment-aggregate.types';
import { logger } from '@/lib/logger';

const ALL_SENTINEL = '_all';

interface SentimentCitationAggregate {
  brandId: string;
  platformId: string;
  locale: string;
  sentimentLabel: string;
  citationCount: number;
  modelRunCount: number;
  scoreSum: number;
}

interface SentimentAggregateRow {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  platformId: string;
  locale: string;
  periodStart: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
  positivePercentage: string;
  neutralPercentage: string;
  negativePercentage: string;
  netSentimentScore: string;
  averageScore: string | null;
  modelRunCount: number;
}

/**
 * Computes sentiment aggregates for a workspace/promptSet/date combination.
 * Idempotent: re-running produces the same result via upsert.
 */
export async function computeSentimentAggregate(
  input: SentimentAggregateComputeInput
): Promise<{ changed: boolean }> {
  const { workspaceId, promptSetId, date } = input;
  const log = logger.child({ workspaceId, promptSetId, date });

  const aggregates = await fetchSentimentAggregates(workspaceId, promptSetId, date);

  if (aggregates.length === 0) {
    log.info('No citations with sentiment found for aggregate computation');
    return { changed: false };
  }

  const rows = expandSentimentAggregates(aggregates, workspaceId, promptSetId, date);

  if (rows.length === 0) {
    return { changed: false };
  }

  const changed = await upsertSentimentRows(rows);

  log.info({ rowCount: rows.length, changed }, 'Sentiment aggregate computation complete');

  return { changed };
}

async function fetchSentimentAggregates(
  workspaceId: string,
  promptSetId: string,
  date: string
): Promise<SentimentCitationAggregate[]> {
  const results = await db
    .select({
      brandId: citation.brandId,
      platformId: citation.platformId,
      locale: sql<string>`COALESCE(${citation.locale}, ${ALL_SENTINEL})`.as('locale'),
      sentimentLabel: citation.sentimentLabel,
      citationCount: sql<number>`COUNT(*)::int`.as('citation_count'),
      modelRunCount: sql<number>`COUNT(DISTINCT ${citation.modelRunId})::int`.as('model_run_count'),
      scoreSum: sql<number>`COALESCE(SUM(${citation.sentimentScore}::float), 0)`.as('score_sum'),
    })
    .from(citation)
    .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.promptSetId, promptSetId),
        inArray(modelRun.status, ['completed', 'partial']),
        sql`DATE(${modelRun.startedAt} AT TIME ZONE 'UTC') = ${date}`,
        isNotNull(citation.sentimentLabel)
      )
    )
    .groupBy(
      citation.brandId,
      citation.platformId,
      sql`COALESCE(${citation.locale}, ${ALL_SENTINEL})`,
      citation.sentimentLabel
    );

  return results as SentimentCitationAggregate[];
}

/**
 * Expands fine-grained sentiment aggregates into 4-level aggregation rows per brand.
 */
export function expandSentimentAggregates(
  aggregates: SentimentCitationAggregate[],
  workspaceId: string,
  promptSetId: string,
  date: string
): SentimentAggregateRow[] {
  // Accumulate counts at each aggregation level
  type SentimentBucket = {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    scoreSum: number;
    modelRunIds: number;
  };

  const buckets = new Map<string, SentimentBucket>();

  function getBucket(key: string): SentimentBucket {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { positive: 0, neutral: 0, negative: 0, total: 0, scoreSum: 0, modelRunIds: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function addToBucket(
    bucket: SentimentBucket,
    label: string,
    count: number,
    scoreSum: number,
    modelRuns: number
  ) {
    if (label === 'positive') bucket.positive += count;
    else if (label === 'neutral') bucket.neutral += count;
    else if (label === 'negative') bucket.negative += count;
    bucket.total += count;
    bucket.scoreSum += scoreSum;
    bucket.modelRunIds += modelRuns;
  }

  for (const agg of aggregates) {
    const { brandId, platformId, locale, sentimentLabel, citationCount, modelRunCount, scoreSum } =
      agg;

    // Level 1: (brand, platform, locale)
    addToBucket(
      getBucket(`${brandId}:${platformId}:${locale}`),
      sentimentLabel,
      citationCount,
      scoreSum,
      modelRunCount
    );
    // Level 2: (brand, platform, '_all')
    addToBucket(
      getBucket(`${brandId}:${platformId}:${ALL_SENTINEL}`),
      sentimentLabel,
      citationCount,
      scoreSum,
      modelRunCount
    );
    // Level 3: (brand, '_all', locale)
    addToBucket(
      getBucket(`${brandId}:${ALL_SENTINEL}:${locale}`),
      sentimentLabel,
      citationCount,
      scoreSum,
      modelRunCount
    );
    // Level 4: (brand, '_all', '_all')
    addToBucket(
      getBucket(`${brandId}:${ALL_SENTINEL}:${ALL_SENTINEL}`),
      sentimentLabel,
      citationCount,
      scoreSum,
      modelRunCount
    );
  }

  const rows: SentimentAggregateRow[] = [];

  for (const [key, bucket] of buckets) {
    if (bucket.total === 0) continue;

    const [brandId, platformId, locale] = key.split(':');
    const positivePercentage = ((bucket.positive / bucket.total) * 100).toFixed(2);
    const neutralPercentage = ((bucket.neutral / bucket.total) * 100).toFixed(2);
    const negativePercentage = ((bucket.negative / bucket.total) * 100).toFixed(2);
    const netSentimentScore = (((bucket.positive - bucket.negative) / bucket.total) * 100).toFixed(
      2
    );
    const averageScore = (bucket.scoreSum / bucket.total).toFixed(4);

    rows.push({
      workspaceId,
      promptSetId,
      brandId,
      platformId,
      locale,
      periodStart: date,
      positiveCount: bucket.positive,
      neutralCount: bucket.neutral,
      negativeCount: bucket.negative,
      totalCount: bucket.total,
      positivePercentage,
      neutralPercentage,
      negativePercentage,
      netSentimentScore,
      averageScore,
      modelRunCount: bucket.modelRunIds,
    });
  }

  return rows;
}

async function upsertSentimentRows(rows: SentimentAggregateRow[]): Promise<boolean> {
  const result = await db
    .insert(sentimentAggregate)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        sentimentAggregate.workspaceId,
        sentimentAggregate.promptSetId,
        sentimentAggregate.brandId,
        sentimentAggregate.platformId,
        sentimentAggregate.locale,
        sentimentAggregate.periodStart,
      ],
      set: {
        positiveCount: sql`excluded.positive_count`,
        neutralCount: sql`excluded.neutral_count`,
        negativeCount: sql`excluded.negative_count`,
        totalCount: sql`excluded.total_count`,
        positivePercentage: sql`excluded.positive_percentage`,
        neutralPercentage: sql`excluded.neutral_percentage`,
        negativePercentage: sql`excluded.negative_percentage`,
        netSentimentScore: sql`excluded.net_sentiment_score`,
        averageScore: sql`excluded.average_score`,
        modelRunCount: sql`excluded.model_run_count`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: sentimentAggregate.id,
    });

  return result.length > 0;
}
