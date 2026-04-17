// ---------------------------------------------------------------------------
// GSC sync service — pulls searchAnalytics data and upserts it into
// `gsc_query_performance`.
//
// Pagination: one GSC page = 25,000 rows. We loop until a response returns
// fewer rows than the row limit.
//
// Idempotency: the unique index on (workspaceId, gscConnectionId, date, query, page)
// means ON CONFLICT DO UPDATE safely overwrites Google's retroactive
// corrections.
// ---------------------------------------------------------------------------

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import {
  searchAnalyticsQuery,
  GscForbiddenError,
  GscRateLimitedError,
  GscReauthRequiredError,
  type GscSearchAnalyticsRow,
} from '@/modules/integrations/gsc/gsc-client';
import {
  getConnectionPublic,
  updateSyncResult,
  updateConnectionStatus,
} from '@/modules/integrations/gsc/gsc-connection.service';
import { gscQueryPerformance } from './gsc-query-performance.schema';

const GSC_PAGE_ROW_LIMIT = 25_000;
const DB_BATCH_SIZE = 500;
const DEFAULT_LOOKBACK_DAYS = 30;

export interface SyncResult {
  gscConnectionId: string;
  propertyUrl: string;
  fromDate: string;
  toDate: string;
  rowsImported: number;
  status: 'completed';
}

export interface SyncPropertyInput {
  workspaceId: string;
  gscConnectionId: string;
  fromDate?: string;
  toDate?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultSyncDateRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
  return { fromDate: isoDate(from), toDate: isoDate(today) };
}

interface InsertRow {
  workspaceId: string;
  gscConnectionId: string;
  propertyUrl: string;
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
}

function rowToInsert(
  r: GscSearchAnalyticsRow,
  base: { workspaceId: string; gscConnectionId: string; propertyUrl: string }
): InsertRow | null {
  const [date, query, page] = r.keys;
  if (!date || !query || !page) return null;
  return {
    ...base,
    date,
    query,
    page,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: String(r.ctr),
    position: String(r.position),
  };
}

async function batchUpsert(rows: InsertRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += DB_BATCH_SIZE) {
    const slice = rows.slice(i, i + DB_BATCH_SIZE);
    await db
      .insert(gscQueryPerformance)
      .values(slice)
      .onConflictDoUpdate({
        target: [
          gscQueryPerformance.workspaceId,
          gscQueryPerformance.gscConnectionId,
          gscQueryPerformance.date,
          gscQueryPerformance.query,
          gscQueryPerformance.page,
        ],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
          updatedAt: new Date(),
        },
      });
  }
}

export async function syncProperty(input: SyncPropertyInput): Promise<SyncResult> {
  const log = logger.child({
    job: 'gsc-sync',
    workspaceId: input.workspaceId,
    gscConnectionId: input.gscConnectionId,
  });

  const connection = await getConnectionPublic(input.workspaceId, input.gscConnectionId);
  if (!connection) throw new Error(`GSC connection not found: ${input.gscConnectionId}`);

  const defaults = defaultSyncDateRange();
  const fromDate = input.fromDate ?? defaults.fromDate;
  const toDate = input.toDate ?? defaults.toDate;

  log.info({ fromDate, toDate, propertyUrl: connection.propertyUrl }, 'Starting GSC sync');

  const base = {
    workspaceId: input.workspaceId,
    gscConnectionId: input.gscConnectionId,
    propertyUrl: connection.propertyUrl,
  };

  let startRow = 0;
  let rowsImported = 0;

  try {
    for (;;) {
      const response = await searchAnalyticsQuery(input.gscConnectionId, {
        startDate: fromDate,
        endDate: toDate,
        dimensions: ['date', 'query', 'page'],
        rowLimit: GSC_PAGE_ROW_LIMIT,
        startRow,
        aggregationType: 'auto',
      });

      const toInsert = response.rows
        .map((r) => rowToInsert(r, base))
        .filter((r): r is InsertRow => r !== null);

      if (toInsert.length > 0) {
        await batchUpsert(toInsert);
        rowsImported += toInsert.length;
      }

      if (response.rows.length < GSC_PAGE_ROW_LIMIT) break;
      startRow += response.rows.length;
    }

    await updateSyncResult(input.gscConnectionId, 'completed');
    log.info({ rowsImported }, 'GSC sync completed');

    return {
      gscConnectionId: input.gscConnectionId,
      propertyUrl: connection.propertyUrl,
      fromDate,
      toDate,
      rowsImported,
      status: 'completed',
    };
  } catch (err) {
    if (err instanceof GscReauthRequiredError) {
      await updateSyncResult(input.gscConnectionId, 'failed', 'Reauthorization required');
      // Status was already marked reauth_required by the client.
    } else if (err instanceof GscForbiddenError) {
      await updateSyncResult(input.gscConnectionId, 'failed', 'Forbidden');
      await updateConnectionStatus(input.gscConnectionId, 'forbidden', 'Google returned 403');
    } else if (err instanceof GscRateLimitedError) {
      await updateSyncResult(input.gscConnectionId, 'throttled', 'Rate limited by Google');
    } else {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await updateSyncResult(input.gscConnectionId, 'failed', message);
    }
    throw err;
  }
}
