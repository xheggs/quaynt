import type { OnboardingMilestones } from './onboarding.schema';

/**
 * Pure predicate for the post-aha persona capture telemetry gate.
 *
 * Emits exactly when:
 *   1. The patch sets `roleHint` to a non-null value, AND
 *   2. The current `roleHint` is null (first-time capture), AND
 *   3. The user has already seen their first earned citation
 *      (`firstCitationSeen === true`).
 *
 * A subsequent PATCH that *changes* the role does not satisfy condition (2)
 * and so does not re-emit. Pre-aha PATCHes do not satisfy (3).
 */
export function shouldEmitPersonaCapturedPostAha(
  current: { roleHint: string | null; milestones: OnboardingMilestones },
  patch: { roleHint?: string | null }
): boolean {
  return (
    patch.roleHint != null &&
    current.roleHint == null &&
    current.milestones.firstCitationSeen === true
  );
}
