import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound } from '@/lib/api/response';
import { getSuggestionById } from '@/modules/onboarding/onboarding-suggest.service';
import { toSuggestionResponse } from '../_response';

const paramsSchema = z.object({
  jobId: z.string().min(1).max(64),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, { params: paramsSchema });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const row = await getSuggestionById(auth.workspaceId, validated.data.params.jobId);
          if (!row) return notFound();

          return apiSuccess(toSuggestionResponse(row));
        }, 'read'),
        { points: 60, duration: 60, keyPrefix: 'rl_onboarding_suggest_get' }
      )
    )
  )
);
