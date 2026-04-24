// ---------------------------------------------------------------------------
// POST /api/v1/integrations/gsc/connections/[id]/sync
//
// Enqueue an on-demand `gsc-sync` job for the given connection. Extra
// throttle: max 5 manual syncs per workspace per hour on top of the standard
// 100/min/key API limit.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getConnectionPublic } from '@/modules/integrations/gsc/gsc-connection.service';
import { createBoss } from '@/lib/jobs/boss';
import { GSC_SYNC_QUEUE } from '@/modules/integrations/gsc-correlation/gsc-sync.constants';
import type { GscSyncJobData } from '@/modules/integrations/gsc-correlation/gsc-sync.constants';

const paramsSchema = z.object({ id: z.string().min(1) });

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withRateLimit(
          withScope(async (req, ctx) => {
            const auth = getAuthContext(req);
            const t = await apiErrors();
            const validated = await validateRequest(req, ctx, { params: paramsSchema });
            if (!validated.success) return validated.response;

            const connection = await getConnectionPublic(
              auth.workspaceId,
              validated.data.params.id
            );
            if (!connection) return notFound(t('resources.gscConnection'));

            const boss = createBoss();
            const jobData: GscSyncJobData = {
              workspaceId: auth.workspaceId,
              gscConnectionId: connection.id,
            };
            await boss.send(GSC_SYNC_QUEUE, jobData, {
              singletonKey: `${GSC_SYNC_QUEUE}:${connection.id}`,
            });

            return apiSuccess({ enqueued: true, connectionId: connection.id });
          }, 'read-write'),
          {
            points: 5,
            duration: 3600,
            keyPrefix: 'rl_gsc_manual_sync',
            keyExtractor: (req) => getAuthContext(req).workspaceId,
          }
        )
      )
    )
  )
);
