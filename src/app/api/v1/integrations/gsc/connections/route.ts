// ---------------------------------------------------------------------------
// /api/v1/integrations/gsc/connections
//   GET  — list connections for the authed workspace (never returns tokens)
//   POST — finalize a pending OAuth flow by picking a property
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiCreated, badRequest, unprocessable } from '@/lib/api/response';
import {
  createConnection,
  listConnections,
} from '@/modules/integrations/gsc/gsc-connection.service';
import {
  GSC_PENDING_COOKIE_NAME,
  verifyPendingCookie,
} from '@/modules/integrations/gsc/gsc-pending-cookie';

const createSchema = z.object({
  propertyUrl: z.string().min(1, 'propertyUrl is required').max(2048),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const connections = await listConnections(auth.workspaceId);
          return apiSuccess({ connections });
        }, 'read')
      )
    )
  )
);

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const validated = await validateRequest(req, ctx, { body: createSchema });
          if (!validated.success) return validated.response;

          const pendingCookieValue = req.cookies.get(GSC_PENDING_COOKIE_NAME)?.value;
          if (!pendingCookieValue) {
            return badRequest('No pending GSC OAuth session. Start the connect flow first.');
          }

          let pending;
          try {
            pending = verifyPendingCookie(pendingCookieValue);
          } catch {
            return badRequest('Pending GSC OAuth session is invalid or expired.');
          }

          if (pending.workspaceId !== auth.workspaceId) {
            return badRequest('Pending GSC OAuth session does not match this workspace.');
          }

          const chosenProperty = validated.data.body.propertyUrl;
          const allowed = pending.sites.find((s) => s.siteUrl === chosenProperty);
          if (!allowed) {
            return unprocessable([
              { field: 'propertyUrl', message: 'Property was not in the authorized site list' },
            ]);
          }

          const connection = await createConnection({
            workspaceId: auth.workspaceId,
            propertyUrl: chosenProperty,
            accessToken: pending.accessToken,
            refreshToken: pending.refreshToken,
            tokenExpiresAt: pending.tokenExpiresAt,
            scope: pending.scope,
          });

          const response = apiCreated({ connection });
          // Clear the pending cookie now that we've consumed it.
          response.cookies.set({
            name: GSC_PENDING_COOKIE_NAME,
            value: '',
            path: '/',
            maxAge: 0,
          });
          return response;
        }, 'read-write')
      )
    )
  )
);
