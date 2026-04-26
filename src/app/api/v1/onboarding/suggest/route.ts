import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit, consumeRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, badRequest, tooManyRequests } from '@/lib/api/response';
import { createBoss } from '@/lib/jobs/boss';
import { logger } from '@/lib/logger';
import { normalizeDomain } from '@/modules/onboarding/domain';
import {
  createPendingSuggestion,
  findInFlightSuggestion,
  findRecentCachedSuggestion,
} from '@/modules/onboarding/onboarding-suggest.service';
import {
  ONBOARDING_SUGGEST_QUEUE,
  type OnboardingSuggestJobData,
} from '@/modules/onboarding/onboarding-suggest.handler';
import { getByWorkspace } from '@/modules/onboarding/onboarding.service';
import { emitOnboardingEvent, OnboardingEvent } from '@/modules/telemetry/onboarding-events';
import { toSuggestionResponse } from './_response';

const suggestRequestSchema = z.object({
  domain: z.string().min(1).max(285),
  regenerate: z.boolean().optional(),
  fromJobId: z.string().optional(),
});

const REGEN_DAILY_POINTS = 3;
const REGEN_DAILY_DURATION_S = 24 * 60 * 60;

const log = logger.child({ module: 'onboarding-suggest-api' });

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, { body: suggestRequestSchema });
          if (!validated.success) return validated.response;
          const auth = getAuthContext(req);
          const normalized = normalizeDomain(validated.data.body.domain);
          if (!normalized.ok) {
            return badRequest(normalized.message, { code: normalized.code, field: 'domain' });
          }
          const { host, baseUrl } = normalized;
          const regenerate = validated.data.body.regenerate === true;
          const fromJobId = validated.data.body.fromJobId ?? null;

          // Regenerate bypasses the 24h cache and consumes a stricter daily
          // budget per workspace to bound LLM cost.
          if (regenerate) {
            const limit = await consumeRateLimit({
              key: auth.workspaceId,
              points: REGEN_DAILY_POINTS,
              duration: REGEN_DAILY_DURATION_S,
              keyPrefix: 'rl_onboarding_suggest_regen',
            });
            if (!limit.ok) {
              return tooManyRequests(limit.retryAfter);
            }
          }

          if (!regenerate) {
            const cached = await findRecentCachedSuggestion(auth.workspaceId, host);
            if (cached) {
              return apiSuccess({
                ...toSuggestionResponse(cached),
                cached: true,
                inFlight: false,
              });
            }
          }

          const inFlight = await findInFlightSuggestion(auth.workspaceId, host);
          if (inFlight) {
            return apiSuccess({
              ...toSuggestionResponse(inFlight),
              cached: false,
              inFlight: true,
            });
          }

          const onboarding = await getByWorkspace(auth.workspaceId);
          const row = await createPendingSuggestion(auth.workspaceId, host);

          const jobData: OnboardingSuggestJobData = {
            suggestionId: row.id,
            workspaceId: auth.workspaceId,
            domain: host,
            baseUrl,
            roleHint: onboarding.roleHint,
            locale: req.headers.get('accept-language')?.split(',')[0]?.trim() || null,
          };

          try {
            const boss = createBoss();
            await boss.send(ONBOARDING_SUGGEST_QUEUE, jobData);
          } catch (e) {
            log.error({ err: e, suggestionId: row.id }, 'Failed to enqueue suggestion job');
            // Leave the row in pending state so a retry can pick it up; clients
            // will see status=pending and may resubmit. We do not fail the
            // request because a synchronous DB row was created successfully.
          }

          if (regenerate) {
            emitOnboardingEvent(
              OnboardingEvent.suggestionRegenerated,
              {
                workspaceId: auth.workspaceId,
                fromJobId,
                toJobId: row.id,
                domain: host,
              },
              log
            );
          }

          return apiSuccess({
            ...toSuggestionResponse(row),
            cached: false,
            inFlight: false,
          });
        }, 'read-write'),
        { points: 5, duration: 60, keyPrefix: 'rl_onboarding_suggest_post' }
      )
    )
  )
);
