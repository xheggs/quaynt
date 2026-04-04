import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess } from '@/lib/api/response';
import {
  getOrCreatePreference,
  updatePreference,
  getOrCreateWorkspacePreference,
  updateWorkspacePreference,
} from '@/modules/notifications/notification.service';

const emailPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  digestFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  digestDay: z.number().int().min(0).max(6).optional(),
  digestTimezone: z.string().optional(),
  severityFilter: z
    .array(z.enum(['info', 'warning', 'critical']))
    .min(1)
    .optional(),
});

const webhookPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  severityFilter: z
    .array(z.enum(['info', 'warning', 'critical']))
    .min(1)
    .optional(),
});

const updatePreferenceSchema = z.object({
  email: emailPreferenceSchema.optional(),
  webhook: webhookPreferenceSchema.optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const url = new URL(req.url);
          const channelFilter = url.searchParams.get('channel');

          const response: Record<string, unknown> = {};

          if (!channelFilter || channelFilter === 'email') {
            if (auth.userId) {
              response.email = await getOrCreatePreference(auth.workspaceId, auth.userId, 'email');
            } else {
              response.email = null;
            }
          }

          if (!channelFilter || channelFilter === 'webhook') {
            response.webhook = await getOrCreateWorkspacePreference(auth.workspaceId, 'webhook');
          }

          return apiSuccess(response);
        }, 'read')
      )
    )
  )
);

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: updatePreferenceSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const response: Record<string, unknown> = {};

          // Handle email preference updates
          const emailUpdates = validated.data.body.email;
          if (emailUpdates) {
            if (!auth.userId) {
              response.email = null;
            } else {
              response.email = await updatePreference(
                auth.workspaceId,
                auth.userId,
                'email',
                emailUpdates
              );
            }
          }

          // Handle webhook preference updates
          const webhookUpdates = validated.data.body.webhook;
          if (webhookUpdates) {
            response.webhook = await updateWorkspacePreference(
              auth.workspaceId,
              'webhook',
              webhookUpdates
            );
          }

          // If no updates provided, return current state
          if (!emailUpdates && !webhookUpdates) {
            if (auth.userId) {
              response.email = await getOrCreatePreference(auth.workspaceId, auth.userId, 'email');
            } else {
              response.email = null;
            }
            response.webhook = await getOrCreateWorkspacePreference(auth.workspaceId, 'webhook');
          }

          return apiSuccess(response);
        }, 'read-write')
      )
    )
  )
);
