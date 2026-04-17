import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paginationConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import { aiVisit } from './ai-visit.schema';
import type { VisitInsert, VisitSource } from './traffic.types';

const log = logger.child({ module: 'ai-visit' });

const BATCH_SIZE = 500;

export async function insertVisit(visit: VisitInsert): Promise<void> {
  await db.insert(aiVisit).values(visit);
}

export async function batchInsertVisits(visits: VisitInsert[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < visits.length; i += BATCH_SIZE) {
    const batch = visits.slice(i, i + BATCH_SIZE);
    await db.insert(aiVisit).values(batch);
    inserted += batch.length;
  }
  return inserted;
}

export interface VisitListFilters {
  from?: string;
  to?: string;
  platform?: string;
  source?: VisitSource;
  siteKeyId?: string;
}

export async function listVisits(
  workspaceId: string,
  filters: VisitListFilters,
  pagination: { page: number; limit: number }
) {
  const conditions: SQL[] = [eq(aiVisit.workspaceId, workspaceId)];
  applyDateRange(conditions, filters, aiVisit.visitedAt);
  if (filters.platform) conditions.push(eq(aiVisit.platform, filters.platform));
  if (filters.source) conditions.push(eq(aiVisit.source, filters.source));
  if (filters.siteKeyId) conditions.push(eq(aiVisit.siteKeyId, filters.siteKeyId));

  const { limit, offset } = paginationConfig(pagination);

  const [items, total] = await Promise.all([
    db
      .select({
        id: aiVisit.id,
        source: aiVisit.source,
        platform: aiVisit.platform,
        landingPath: aiVisit.landingPath,
        referrerHost: aiVisit.referrerHost,
        userAgentFamily: aiVisit.userAgentFamily,
        visitedAt: aiVisit.visitedAt,
      })
      .from(aiVisit)
      .where(and(...conditions))
      .orderBy(desc(aiVisit.visitedAt))
      .limit(limit)
      .offset(offset),
    countTotal(aiVisit, conditions),
  ]);

  return { items, total };
}

export async function getAffectedDates(workspaceId: string, since: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      date: sql<string>`date(${aiVisit.visitedAt} AT TIME ZONE 'UTC')`,
    })
    .from(aiVisit)
    .where(and(eq(aiVisit.workspaceId, workspaceId), sql`${aiVisit.createdAt} >= ${since}`));

  return rows.map((r) => r.date);
}

export async function purgeOldVisits(retentionDays: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  await db.delete(aiVisit).where(lt(aiVisit.visitedAt, cutoff));

  log.info({ retentionDays, cutoffDate: cutoff.toISOString() }, 'Purged old AI visits');
}
