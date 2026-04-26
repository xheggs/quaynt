import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import {
  OnboardingEvent,
  emitOnboardingEvent,
  onboardingEventPayloadSchemas,
} from './onboarding-events';

function makeStubLogger() {
  const info = vi.fn();
  const debug = vi.fn();
  const childCalls: Array<Record<string, unknown>> = [];
  const child = vi.fn().mockImplementation((bindings: Record<string, unknown>) => {
    childCalls.push(bindings);
    return { info, debug };
  });
  const logger = { child, debug } as unknown as pino.Logger;
  return { logger, info, debug, childCalls };
}

describe('emitOnboardingEvent', () => {
  it('emits via a child logger with telemetryEvent binding', () => {
    const { logger, info, childCalls } = makeStubLogger();
    emitOnboardingEvent(
      OnboardingEvent.firstRunTriggered,
      { workspaceId: 'ws_1', userId: 'u_1' },
      logger
    );
    expect(childCalls.at(-1)?.telemetryEvent).toBe(OnboardingEvent.firstRunTriggered);
    expect(info).toHaveBeenCalledTimes(1);
    const arg = info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.workspaceId).toBe('ws_1');
  });

  it('drops invalid payloads silently (debug log, no throw, no info)', () => {
    const { logger, info, debug } = makeStubLogger();
    expect(() =>
      emitOnboardingEvent(
        OnboardingEvent.stepCompleted,
        // @ts-expect-error intentionally invalid
        { workspaceId: 42 },
        logger
      )
    ).not.toThrow();
    expect(info).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalled();
  });

  it('exports a payload schema for every event', () => {
    for (const value of Object.values(OnboardingEvent)) {
      expect(onboardingEventPayloadSchemas[value]).toBeDefined();
    }
  });
});

describe('onboarding event names', () => {
  it('uses the dotted onboarding.* prefix', () => {
    for (const value of Object.values(OnboardingEvent)) {
      expect(value.startsWith('onboarding.')).toBe(true);
    }
  });
});

describe('payload validation', () => {
  it('requires workspaceId on every event', () => {
    for (const event of Object.values(OnboardingEvent)) {
      const schema = onboardingEventPayloadSchemas[event];
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    }
  });

  it('accepts the documented minimum payload', () => {
    const ok = onboardingEventPayloadSchemas[OnboardingEvent.firstCitationSeen].safeParse({
      workspaceId: 'ws_1',
    });
    expect(ok.success).toBe(true);
  });

  it('records the step transition for step_completed', () => {
    const ok = onboardingEventPayloadSchemas[OnboardingEvent.stepCompleted].safeParse({
      workspaceId: 'ws_1',
      userId: null,
      fromStep: 'welcome',
      toStep: 'brand',
    });
    expect(ok.success).toBe(true);
  });

  it('records a numeric gap for second_session', () => {
    const ok = onboardingEventPayloadSchemas[OnboardingEvent.secondSession].safeParse({
      workspaceId: 'ws_1',
      gapMs: 7200000,
    });
    expect(ok.success).toBe(true);
  });

  it('validates an enum role on persona_captured_post_aha', () => {
    const ok = onboardingEventPayloadSchemas[OnboardingEvent.personaCapturedPostAha].safeParse({
      workspaceId: 'ws_1',
      userId: null,
      role: 'marketing',
    });
    expect(ok.success).toBe(true);

    const rejected = onboardingEventPayloadSchemas[
      OnboardingEvent.personaCapturedPostAha
    ].safeParse({
      workspaceId: 'ws_1',
      role: 'not-a-role',
    });
    expect(rejected.success).toBe(false);
  });
});

// Sanity: emitting the same event twice with the same payload produces two
// log lines. Idempotency is enforced *upstream* at persistence boundaries
// (see service tests), not here — the helper itself is intentionally
// stateless so retried writes don't silently swallow events.
describe('emitter has no built-in dedup', () => {
  it('emits once per call', () => {
    const { logger, info } = makeStubLogger();
    emitOnboardingEvent(OnboardingEvent.tourCompleted, { workspaceId: 'ws_1' }, logger);
    emitOnboardingEvent(OnboardingEvent.tourCompleted, { workspaceId: 'ws_1' }, logger);
    expect(info).toHaveBeenCalledTimes(2);
  });
});
