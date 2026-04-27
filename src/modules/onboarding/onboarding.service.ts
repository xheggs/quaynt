import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  workspaceOnboarding,
  type OnboardingMilestones,
  type OnboardingStep,
  DEFAULT_ONBOARDING_MILESTONES,
} from './onboarding.schema';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { OnboardingEvent, emitOnboardingEvent } from '@/modules/telemetry/onboarding-events';
import { ONBOARDING_ROLE_HINTS } from './onboarding.types';
import { shouldEmitPersonaCapturedPostAha } from './persona-capture-gate';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OnboardingState = {
  id: string;
  workspaceId: string;
  step: OnboardingStep;
  roleHint: string | null;
  milestones: OnboardingMilestones;
  /** Server-derived: not stored in `milestones` jsonb. */
  resultsViewed: boolean;
  /** Server-derived: latest non-terminal model_run id for the workspace, if any. */
  activeRunId: string | null;
  completedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Insert the initial workspace_onboarding row for a freshly created workspace.
 * Idempotent on the unique workspaceId index. Designed to run inside the
 * signup transaction.
 */
export async function initialize(tx: Tx, workspaceId: string): Promise<void> {
  await tx
    .insert(workspaceOnboarding)
    .values({
      workspaceId,
      step: 'welcome',
      milestones: DEFAULT_ONBOARDING_MILESTONES,
    })
    .onConflictDoNothing({ target: workspaceOnboarding.workspaceId });
}

// `resultsViewed` is true once the workspace's first run has reached a terminal
// state — including completed-with-zero-citations, cancelled, or failed. We do
// not require a `citation` row here because a successful but quiet run still
// satisfies the JTBD (we ran on the user's behalf), and gating completion on
// citations would strand any user whose first run produced none.
async function hasResultsViewed(workspaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ exists: sql<number>`1` })
    .from(modelRun)
    .where(and(eq(modelRun.workspaceId, workspaceId), isNotNull(modelRun.completedAt)))
    .limit(1);

  return Boolean(row);
}

// Latest non-terminal run for the workspace. Used by callers (the layout
// redirect, the prompt-set launcher, the checklist) to route the user back to
// the run they already started instead of re-asking them to start a new one.
async function getActiveRunId(workspaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: modelRun.id })
    .from(modelRun)
    .where(and(eq(modelRun.workspaceId, workspaceId), isNull(modelRun.completedAt)))
    .orderBy(desc(modelRun.createdAt))
    .limit(1);

  return row?.id ?? null;
}

function rowToState(
  row: typeof workspaceOnboarding.$inferSelect,
  resultsViewed: boolean,
  activeRunId: string | null
): OnboardingState {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    step: row.step,
    roleHint: row.roleHint,
    // Merge with defaults so milestones added after a row was created (jsonb is
    // not auto-backfilled) read as `false` instead of `undefined`.
    milestones: { ...DEFAULT_ONBOARDING_MILESTONES, ...row.milestones },
    resultsViewed,
    activeRunId,
    completedAt: row.completedAt,
    dismissedAt: row.dismissedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function allMilestonesDone(milestones: OnboardingMilestones, resultsViewed: boolean): boolean {
  return (
    milestones.brandAdded &&
    milestones.competitorsAdded &&
    milestones.promptSetSelected &&
    milestones.firstRunTriggered &&
    resultsViewed
  );
}

/**
 * Fetch onboarding state for a workspace. Lazy-creates the row if missing
 * (self-healing for users whose signup predates this feature). Computes the
 * derived `resultsViewed` milestone and auto-marks `completedAt` when all
 * five milestones are satisfied.
 */
export async function getByWorkspace(workspaceId: string): Promise<OnboardingState> {
  let [row] = await db
    .select()
    .from(workspaceOnboarding)
    .where(eq(workspaceOnboarding.workspaceId, workspaceId))
    .limit(1);

  if (!row) {
    [row] = await db
      .insert(workspaceOnboarding)
      .values({
        workspaceId,
        step: 'welcome',
        milestones: DEFAULT_ONBOARDING_MILESTONES,
      })
      .onConflictDoNothing({ target: workspaceOnboarding.workspaceId })
      .returning();

    if (!row) {
      [row] = await db
        .select()
        .from(workspaceOnboarding)
        .where(eq(workspaceOnboarding.workspaceId, workspaceId))
        .limit(1);
    }
  }

  const [resultsViewed, activeRunId] = await Promise.all([
    hasResultsViewed(workspaceId),
    getActiveRunId(workspaceId),
  ]);

  if (!row.completedAt && !row.dismissedAt && allMilestonesDone(row.milestones, resultsViewed)) {
    const [updated] = await db
      .update(workspaceOnboarding)
      .set({ completedAt: new Date(), step: 'done' })
      .where(eq(workspaceOnboarding.workspaceId, workspaceId))
      .returning();
    if (updated) row = updated;
  }

  return rowToState(row, resultsViewed, activeRunId);
}

export type UpdateOnboardingPatch = {
  step?: OnboardingStep;
  roleHint?: string | null;
  milestones?: Partial<OnboardingMilestones>;
  dismissedAt?: Date | null;
};

export async function update(
  workspaceId: string,
  patch: UpdateOnboardingPatch,
  context: { userId?: string | null } = {}
): Promise<OnboardingState> {
  const current = await getByWorkspace(workspaceId);

  const updateData: Record<string, unknown> = {};
  if (patch.step !== undefined) updateData.step = patch.step;
  if (patch.roleHint !== undefined) updateData.roleHint = patch.roleHint;
  if (patch.dismissedAt !== undefined) updateData.dismissedAt = patch.dismissedAt;
  if (patch.milestones) {
    updateData.milestones = { ...current.milestones, ...patch.milestones };
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(workspaceOnboarding)
      .set(updateData)
      .where(eq(workspaceOnboarding.workspaceId, workspaceId));
  }

  const next = await getByWorkspace(workspaceId);

  // Telemetry: emit only at the persistence-transition boundary so each
  // event is idempotent across retries / concurrent PATCHes. A flag that is
  // already true cannot transition again.
  const userId = context.userId ?? null;

  if (patch.step !== undefined && patch.step !== current.step) {
    emitOnboardingEvent(OnboardingEvent.stepCompleted, {
      workspaceId,
      userId,
      fromStep: current.step,
      toStep: next.step,
    });
  }

  if (patch.milestones) {
    if (
      patch.milestones.firstRunTriggered === true &&
      !current.milestones.firstRunTriggered &&
      next.milestones.firstRunTriggered
    ) {
      emitOnboardingEvent(OnboardingEvent.firstRunTriggered, {
        workspaceId,
        userId,
      });
    }
    if (
      patch.milestones.firstCitationSeen === true &&
      !current.milestones.firstCitationSeen &&
      next.milestones.firstCitationSeen
    ) {
      emitOnboardingEvent(OnboardingEvent.firstCitationSeen, {
        workspaceId,
        userId,
      });
    }
    if (
      patch.milestones.tourCompleted === true &&
      !current.milestones.tourCompleted &&
      next.milestones.tourCompleted
    ) {
      emitOnboardingEvent(OnboardingEvent.tourCompleted, {
        workspaceId,
        userId,
      });
    }
  }

  // Post-aha persona capture. Idempotency: emit only on the null → non-null
  // transition AND only when the user has already seen their first citation.
  // A second PATCH that *changes* the role does not re-emit; that is intentional.
  if (shouldEmitPersonaCapturedPostAha(current, patch)) {
    emitOnboardingEvent(OnboardingEvent.personaCapturedPostAha, {
      workspaceId,
      userId,
      role: patch.roleHint as (typeof ONBOARDING_ROLE_HINTS)[number],
    });
  }

  return next;
}

export async function markMilestone(
  workspaceId: string,
  key: keyof OnboardingMilestones
): Promise<OnboardingState> {
  return update(workspaceId, { milestones: { [key]: true } as Partial<OnboardingMilestones> });
}

export async function dismiss(workspaceId: string): Promise<OnboardingState> {
  return update(workspaceId, { dismissedAt: new Date() });
}

export async function complete(workspaceId: string): Promise<OnboardingState> {
  await db
    .update(workspaceOnboarding)
    .set({ completedAt: new Date(), step: 'done' })
    .where(eq(workspaceOnboarding.workspaceId, workspaceId));
  return getByWorkspace(workspaceId);
}

/**
 * Drives the `onboarding.second_session` telemetry event.
 *
 * Called once per `(app)/layout` request. The event fires the first time a
 * workspace's session-history shows a gap of more than `gapThresholdMs` from
 * the last seen timestamp AND the current session was created within
 * `freshSessionMs` of now (i.e. the user just signed back in). Persistence
 * of `secondSessionEmittedAt` is the dedup boundary — concurrent layout
 * requests at session boundary cannot double-emit.
 *
 * Always updates `lastSeenAt` so subsequent calls reflect the current visit.
 */
export async function recordVisit(
  workspaceId: string,
  options: {
    sessionCreatedAt: Date;
    userId?: string | null;
    now?: Date;
    gapThresholdMs?: number;
    freshSessionMs?: number;
  }
): Promise<void> {
  const now = options.now ?? new Date();
  const gapThresholdMs = options.gapThresholdMs ?? 60 * 60 * 1000; // 1 h
  const freshSessionMs = options.freshSessionMs ?? 5 * 60 * 1000; // 5 min

  const [row] = await db
    .select({
      lastSeenAt: workspaceOnboarding.lastSeenAt,
      secondSessionEmittedAt: workspaceOnboarding.secondSessionEmittedAt,
    })
    .from(workspaceOnboarding)
    .where(eq(workspaceOnboarding.workspaceId, workspaceId))
    .limit(1);

  if (!row) return;

  const sessionAgeMs = now.getTime() - options.sessionCreatedAt.getTime();
  const gapMs = row.lastSeenAt ? now.getTime() - row.lastSeenAt.getTime() : 0;
  const shouldEmitSecondSession =
    !row.secondSessionEmittedAt &&
    row.lastSeenAt !== null &&
    gapMs > gapThresholdMs &&
    sessionAgeMs < freshSessionMs;

  if (shouldEmitSecondSession) {
    // Conditional persistence: only flip the flag if it is still null.
    // The WHERE clause is the dedup boundary against concurrent layouts.
    const updated = await db
      .update(workspaceOnboarding)
      .set({ secondSessionEmittedAt: now, lastSeenAt: now })
      .where(
        and(
          eq(workspaceOnboarding.workspaceId, workspaceId),
          // Drizzle treats undefined as omitted, so use sql for IS NULL.
          sql`${workspaceOnboarding.secondSessionEmittedAt} IS NULL`
        )
      )
      .returning({ id: workspaceOnboarding.id });

    if (updated.length > 0) {
      emitOnboardingEvent(OnboardingEvent.secondSession, {
        workspaceId,
        userId: options.userId ?? null,
        gapMs,
      });
    }
    return;
  }

  // Always touch lastSeenAt; cheap UPDATE with no event.
  await db
    .update(workspaceOnboarding)
    .set({ lastSeenAt: now })
    .where(eq(workspaceOnboarding.workspaceId, workspaceId));
}
