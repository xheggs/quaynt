// ---------------------------------------------------------------------------
// /api/v1/integrations/gsc/connections/[id]
//   DELETE — revoke the Google token and delete the connection (cascade).
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiNoContent, notFound } from '@/lib/api/response';
import { deleteConnection } from '@/modules/integrations/gsc/gsc-connection.service';

const paramsSchema = z.object({ id: z.string().min(1) });

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const validated = await validateRequest(req, ctx, { params: paramsSchema });
          if (!validated.success) return validated.response;

          const deleted = await deleteConnection(auth.workspaceId, validated.data.params.id);
          if (!deleted) return notFound('GSC connection not found');
          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
