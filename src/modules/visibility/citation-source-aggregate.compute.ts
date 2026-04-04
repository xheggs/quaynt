import { and, eq, sql, isNotNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from '@/modules/citations/citation.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { citationSourceAggregate } from './citation-source-aggregate.schema';
import type { CitationSourceComputeInput } from './citation-source-aggregate.types';
import { logger } from '@/lib/logger';

const ALL_SENTINEL = '_all';

interface SourceCitationAggregate {
  brandId: string;
  platformId: string;
  locale: string;
  domain: string;
  frequency: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface SourceRow {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  platformId: string;
  locale: string;
  domain: string;
  periodStart: string;
  frequency: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Computes citation source aggregates for a workspace/promptSet/date combination.
 * Idempotent: re-running produces the same result via upsert.
 *
 * Returns { changed: true } if any frequency values were inserted or modified.
 */
export async function computeCitationSourceAggregate(
  input: CitationSourceComputeInput
): Promise<{ changed: boolean }> {
  const { workspaceId, promptSetId, date } = input;
  const log = logger.child({ workspaceId, promptSetId, date });

  const aggregates = await fetchSourceAggregates(workspaceId, promptSetId, date);

  if (aggregates.length === 0) {
    log.info('No citations with domain found for source aggregate computation');
    return { changed: false };
  }

  const rows = expandSourceAggregates(aggregates, workspaceId, promptSetId, date);

  if (rows.length === 0) {
    return { changed: false };
  }

  const changed = await upsertSourceRows(rows);

  log.info({ rowCount: rows.length, changed }, 'Citation source aggregate computation complete');

  return { changed };
}

/**
 * Queries citations for a given workspace/promptSet/date and groups by
 * brand, platform, locale, domain — returning frequency counts and timestamp bounds.
 */
async function fetchSourceAggregates(
  workspaceId: string,
  promptSetId: string,
  date: string
): Promise<SourceCitationAggregate[]> {
  const results = await db
    .select({
      brandId: citation.brandId,
      platformId: citation.platformId,
      locale: sql<string>`COALESCE(${citation.locale}, ${ALL_SENTINEL})`.as('locale'),
      domain: citation.domain,
      frequency: sql<number>`COUNT(*)::int`.as('frequency'),
      firstSeenAt: sql<Date>`MIN(${citation.createdAt})`.as('first_seen_at'),
      lastSeenAt: sql<Date>`MAX(${citation.createdAt})`.as('last_seen_at'),
    })
    .from(citation)
    .innerJoin(modelRun, eq(citation.modelRunId, modelRun.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.promptSetId, promptSetId),
        inArray(modelRun.status, ['completed', 'partial']),
        sql`DATE(${modelRun.startedAt} AT TIME ZONE 'UTC') = ${date}`,
        isNotNull(citation.domain)
      )
    )
    .groupBy(
      citation.brandId,
      citation.platformId,
      sql`COALESCE(${citation.locale}, ${ALL_SENTINEL})`,
      citation.domain
    );

  return results as SourceCitationAggregate[];
}

/**
 * Expands fine-grained source aggregates into 4-level aggregation rows per brand per domain:
 * 1. (platformId, locale) — most granular
 * 2. (platformId, '_all') — all locales for this platform
 * 3. ('_all', locale) — all platforms for this locale
 * 4. ('_all', '_all') — global
 */
export function expandSourceAggregates(
  aggregates: SourceCitationAggregate[],
  workspaceId: string,
  promptSetId: string,
  date: string
): SourceRow[] {
  interface SourceBucket {
    frequency: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }

  const buckets = new Map<string, SourceBucket>();

  function addToBucket(key: string, frequency: number, firstSeenAt: Date, lastSeenAt: Date) {
    const existing = buckets.get(key);
    if (existing) {
      existing.frequency += frequency;
      if (firstSeenAt < existing.firstSeenAt) existing.firstSeenAt = firstSeenAt;
      if (lastSeenAt > existing.lastSeenAt) existing.lastSeenAt = lastSeenAt;
    } else {
      buckets.set(key, { frequency, firstSeenAt, lastSeenAt });
    }
  }

  for (const agg of aggregates) {
    const { brandId, platformId, locale, domain, frequency, firstSeenAt, lastSeenAt } = agg;

    // Level 1: (brand, platform, locale, domain)
    addToBucket(`${brandId}:${platformId}:${locale}:${domain}`, frequency, firstSeenAt, lastSeenAt);
    // Level 2: (brand, platform, '_all', domain)
    addToBucket(
      `${brandId}:${platformId}:${ALL_SENTINEL}:${domain}`,
      frequency,
      firstSeenAt,
      lastSeenAt
    );
    // Level 3: (brand, '_all', locale, domain)
    addToBucket(
      `${brandId}:${ALL_SENTINEL}:${locale}:${domain}`,
      frequency,
      firstSeenAt,
      lastSeenAt
    );
    // Level 4: (brand, '_all', '_all', domain)
    addToBucket(
      `${brandId}:${ALL_SENTINEL}:${ALL_SENTINEL}:${domain}`,
      frequency,
      firstSeenAt,
      lastSeenAt
    );
  }

  const rows: SourceRow[] = [];

  for (const [key, bucket] of buckets) {
    if (bucket.frequency === 0) continue;

    const [brandId, platformId, locale, ...domainParts] = key.split(':');
    // Domain may contain colons (e.g., IPv6), rejoin after the first 3 segments
    const domain = domainParts.join(':');

    rows.push({
      workspaceId,
      promptSetId,
      brandId,
      platformId,
      locale,
      domain,
      periodStart: date,
      frequency: bucket.frequency,
      firstSeenAt: bucket.firstSeenAt,
      lastSeenAt: bucket.lastSeenAt,
    });
  }

  return rows;
}

/**
 * Upserts citation source aggregate rows and returns whether any values changed.
 * Uses LEAST/GREATEST for firstSeenAt/lastSeenAt to maintain correct bounds across upserts.
 */
async function upsertSourceRows(rows: SourceRow[]): Promise<boolean> {
  const result = await db
    .insert(citationSourceAggregate)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        citationSourceAggregate.workspaceId,
        citationSourceAggregate.promptSetId,
        citationSourceAggregate.brandId,
        citationSourceAggregate.platformId,
        citationSourceAggregate.locale,
        citationSourceAggregate.domain,
        citationSourceAggregate.periodStart,
      ],
      set: {
        frequency: sql`excluded.frequency`,
        firstSeenAt: sql`LEAST(${citationSourceAggregate.firstSeenAt}, excluded.first_seen_at)`,
        lastSeenAt: sql`GREATEST(${citationSourceAggregate.lastSeenAt}, excluded.last_seen_at)`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: citationSourceAggregate.id,
    });

  return result.length > 0;
}
