import { z } from 'zod';
import type pino from 'pino';
import { logger as defaultLogger } from '@/lib/logger';
import { ONBOARDING_ROLE_HINTS } from '@/modules/onboarding/onboarding.types';

/**
 * Onboarding telemetry events.
 *
 * Each event is emitted to the structured pino log channel under a
 * `telemetryEvent` key. Self-hosters can extract them downstream via:
 *
 *     jq 'select(.telemetryEvent != null)' < quaynt.log
 *
 * No analytics infrastructure is configured in this PRP — the queryable
 * funnel surface is a future PRP. See `docs/architecture/onboarding-telemetry.md`.
 *
 * Idempotency boundaries are documented per-event below; emission helpers do
 * not deduplicate. Callers must invoke them only at the documented
 * persistence boundary so duplicate emission is impossible.
 */
export const OnboardingEvent = {
  signedUp: 'onboarding.signed_up',
  stepCompleted: 'onboarding.step_completed',
  firstRunTriggered: 'onboarding.first_run_triggered',
  firstCitationSeen: 'onboarding.first_citation_seen',
  tourCompleted: 'onboarding.tour_completed',
  secondSession: 'onboarding.second_session',
  personaCapturedPostAha: 'onboarding.persona_captured_post_aha',
  suggestionRegenerated: 'onboarding.suggestion_regenerated',
} as const;

export type OnboardingEventName = (typeof OnboardingEvent)[keyof typeof OnboardingEvent];

const baseSchema = z.object({
  workspaceId: z.string(),
  userId: z.string().nullable().optional(),
});

export const onboardingEventPayloadSchemas = {
  [OnboardingEvent.signedUp]: baseSchema,
  [OnboardingEvent.stepCompleted]: baseSchema.extend({
    fromStep: z.string().nullable(),
    toStep: z.string(),
  }),
  [OnboardingEvent.firstRunTriggered]: baseSchema.extend({
    runId: z.string().optional(),
  }),
  [OnboardingEvent.firstCitationSeen]: baseSchema.extend({
    runId: z.string().optional(),
    citationId: z.string().optional(),
  }),
  [OnboardingEvent.tourCompleted]: baseSchema,
  [OnboardingEvent.secondSession]: baseSchema.extend({
    gapMs: z.number(),
  }),
  [OnboardingEvent.personaCapturedPostAha]: baseSchema.extend({
    role: z.enum(ONBOARDING_ROLE_HINTS),
  }),
  [OnboardingEvent.suggestionRegenerated]: baseSchema.extend({
    fromJobId: z.string().nullable(),
    toJobId: z.string(),
    domain: z.string(),
  }),
} satisfies Record<OnboardingEventName, z.ZodTypeAny>;

export type OnboardingEventPayload<E extends OnboardingEventName> = z.infer<
  (typeof onboardingEventPayloadSchemas)[E]
>;

/**
 * Emit an onboarding telemetry event to the structured log channel.
 *
 * The payload is validated against the schema for the given event so callers
 * can't drift the shape over time. Validation failures are logged at debug
 * level and the event is dropped — telemetry must never throw into a request.
 */
export function emitOnboardingEvent<E extends OnboardingEventName>(
  event: E,
  payload: OnboardingEventPayload<E>,
  log: pino.Logger = defaultLogger
): void {
  const schema = onboardingEventPayloadSchemas[event];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    log.debug(
      { telemetryEvent: event, errors: parsed.error.flatten() },
      'invalid onboarding telemetry payload'
    );
    return;
  }
  try {
    log.child({ telemetryEvent: event }).info(parsed.data);
  } catch {
    // Telemetry must never throw into a request. Swallow logger transport
    // failures rather than letting them propagate up to the route handler.
  }
}
