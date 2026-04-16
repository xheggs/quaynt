import { eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { crawlerVisit } from './crawler-visit.schema';
import { identifyBot } from './crawler-bot-dictionary';
import type { VisitInsert, PushVisitInput, BotCategory } from './crawler.types';

const log = logger.child({ module: 'crawler-visit' });

const BATCH_SIZE = 500;

/**
 * Batch insert visit records (500 per INSERT statement).
 */
export async function batchInsertVisits(visits: VisitInsert[]): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < visits.length; i += BATCH_SIZE) {
    const batch = visits.slice(i, i + BATCH_SIZE);
    await db.insert(crawlerVisit).values(batch);
    inserted += batch.length;
  }

  return inserted;
}

/**
 * Process and insert visits from the API push endpoint.
 * Auto-detects bot from userAgent if botName is omitted.
 * Returns accepted/rejected counts with per-entry error details.
 */
export async function pushVisits(
  workspaceId: string,
  inputs: PushVisitInput[]
): Promise<{
  accepted: number;
  rejected: number;
  errors: Array<{ index: number; message: string }>;
}> {
  const validVisits: VisitInsert[] = [];
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const visitedAt = new Date(input.visitedAt);

    if (isNaN(visitedAt.getTime())) {
      errors.push({ index: i, message: 'Invalid visitedAt date' });
      continue;
    }

    let botName = input.botName;
    let botCategory: BotCategory = 'search';

    if (!botName) {
      const match = identifyBot(input.userAgent);
      if (!match) {
        errors.push({ index: i, message: 'User-agent does not match any known AI bot' });
        continue;
      }
      botName = match.name;
      botCategory = match.category;
    }

    validVisits.push({
      workspaceId,
      uploadId: null,
      botName,
      botCategory,
      userAgent: input.userAgent,
      requestPath: input.requestPath,
      requestMethod: input.requestMethod ?? 'GET',
      statusCode: input.statusCode ?? 200,
      responseBytes: input.responseBytes ?? 0,
      visitedAt,
    });
  }

  if (validVisits.length > 0) {
    await batchInsertVisits(validVisits);
  }

  log.info(
    { workspaceId, accepted: validVisits.length, rejected: errors.length },
    'Push visits processed'
  );

  return { accepted: validVisits.length, rejected: errors.length, errors };
}

/**
 * Get distinct dates affected by a specific upload (for aggregate scheduling).
 */
export async function getAffectedDates(uploadId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      date: sql<string>`date(${crawlerVisit.visitedAt} AT TIME ZONE 'UTC')`,
    })
    .from(crawlerVisit)
    .where(eq(crawlerVisit.uploadId, uploadId));

  return rows.map((r) => r.date);
}

/**
 * Purge raw visit records older than the retention threshold.
 * Returns the number of deleted rows.
 */
export async function purgeOldVisits(retentionDays: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  await db.delete(crawlerVisit).where(lt(crawlerVisit.visitedAt, cutoff));

  log.info({ retentionDays, cutoffDate: cutoff.toISOString() }, 'Purged old crawler visits');
}
