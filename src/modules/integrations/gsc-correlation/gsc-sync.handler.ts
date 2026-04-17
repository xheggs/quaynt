// ---------------------------------------------------------------------------
// pg-boss handler: `gsc-sync` (per-connection) + `gsc-daily-sync` (scheduled).
//
// Concurrency: capped at 4 workers globally on the `gsc-sync` queue. Per-
// connection singleton keys prevent concurrent syncs of the same connection.
// ---------------------------------------------------------------------------

import type { PgBoss } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { gscConnection } from '@/modules/integrations/gsc/gsc-connection.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { syncProperty } from './gsc-sync.service';
import { GSC_SYNC_QUEUE, GSC_DAILY_SYNC_QUEUE, type GscSyncJobData } from './gsc-sync.constants';

const MAX_CONCURRENT_SYNCS = 4;
const DAILY_CRON = '0 6 * * *'; // 06:00 UTC

export async function registerGscSyncHandler(boss: PgBoss): Promise<void> {
  await boss.work<GscSyncJobData>(
    GSC_SYNC_QUEUE,
    { includeMetadata: true, localConcurrency: MAX_CONCURRENT_SYNCS },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, gscConnectionId, fromDate, toDate } = job.data;
        const log = logger.child({ jobId: job.id, workspaceId, gscConnectionId });
        try {
          const result = await syncProperty({ workspaceId, gscConnectionId, fromDate, toDate });
          log.info({ rowsImported: result.rowsImported }, 'gsc-sync handler completed');

          await dispatchWebhookEvent(
            workspaceId,
            'gsc.sync_completed',
            {
              gscSync: {
                workspaceId,
                gscConnectionId,
                propertyUrl: result.propertyUrl,
                fromDate: result.fromDate,
                toDate: result.toDate,
                rowsImported: result.rowsImported,
                status: result.status,
              },
            },
            boss
          );
        } catch (err) {
          log.error({ err }, 'gsc-sync handler failed');
          throw err; // Let pg-boss track the failure.
        }
      }
    }
  );

  await boss.schedule(GSC_DAILY_SYNC_QUEUE, DAILY_CRON, {});
  await boss.work(
    GSC_DAILY_SYNC_QUEUE,
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      const log = logger.child({ job: GSC_DAILY_SYNC_QUEUE });

      const activeConnections = await db
        .select({
          id: gscConnection.id,
          workspaceId: gscConnection.workspaceId,
        })
        .from(gscConnection)
        .where(eq(gscConnection.status, 'active'));

      log.info({ connections: activeConnections.length }, 'Enqueuing daily GSC syncs');

      for (const c of activeConnections) {
        const data: GscSyncJobData = { workspaceId: c.workspaceId, gscConnectionId: c.id };
        await boss.send(GSC_SYNC_QUEUE, data, {
          singletonKey: `${GSC_SYNC_QUEUE}:${c.id}`,
        });
      }
    }
  );
}
