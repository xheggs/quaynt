import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess } from '@/lib/api/response';
import { getByWorkspace, update } from '@/modules/onboarding/onboarding.service';
import {
  updateOnboardingSchema,
  type OnboardingResponse,
} from '@/modules/onboarding/onboarding.types';
import type { OnboardingState } from '@/modules/onboarding/onboarding.service';

function toResponse(state: OnboardingState): OnboardingResponse {
  return {
    workspaceId: state.workspaceId,
    step: state.step,
    roleHint: (state.roleHint ?? null) as OnboardingResponse['roleHint'],
    milestones: {
      ...state.milestones,
      resultsViewed: state.resultsViewed,
    },
    activeRunId: state.activeRunId,
    completedAt: state.completedAt?.toISOString() ?? null,
    dismissedAt: state.dismissedAt?.toISOString() ?? null,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };
}

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const state = await getByWorkspace(auth.workspaceId);
          return apiSuccess(toResponse(state));
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
            body: updateOnboardingSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const { body } = validated.data;

          const patch: Parameters<typeof update>[1] = {};
          if (body.step !== undefined) patch.step = body.step;
          if (body.roleHint !== undefined) patch.roleHint = body.roleHint;
          if (body.milestones) patch.milestones = body.milestones;
          if (body.dismissedAt !== undefined) {
            patch.dismissedAt = body.dismissedAt === null ? null : new Date(body.dismissedAt);
          }

          const state = await update(auth.workspaceId, patch, { userId: auth.userId });
          return apiSuccess(toResponse(state));
        }, 'read-write'),
        { points: 10, duration: 60, keyPrefix: 'rl_onboarding' }
      )
    )
  )
);
