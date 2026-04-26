import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  onboardingSuggestion,
  type OnboardingSuggestionCompetitor,
  type OnboardingSuggestionError,
  type OnboardingSuggestionExtracted,
  type OnboardingSuggestionPrompt,
  type OnboardingSuggestionStatus,
} from './onboarding.schema';

export type OnboardingSuggestionRecord = {
  id: string;
  workspaceId: string;
  domain: string;
  status: OnboardingSuggestionStatus;
  error: OnboardingSuggestionError | null;
  extracted: OnboardingSuggestionExtracted | null;
  suggestedCompetitors: OnboardingSuggestionCompetitor[] | null;
  suggestedPrompts: OnboardingSuggestionPrompt[] | null;
  engineUsed: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const CACHE_TTL_HOURS = 24;
const IN_FLIGHT_STATUSES: OnboardingSuggestionStatus[] = ['pending', 'fetching', 'suggesting'];

function rowToRecord(row: typeof onboardingSuggestion.$inferSelect): OnboardingSuggestionRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    domain: row.domain,
    status: row.status,
    error: row.error ?? null,
    extracted: row.extracted ?? null,
    suggestedCompetitors: row.suggestedCompetitors ?? null,
    suggestedPrompts: row.suggestedPrompts ?? null,
    engineUsed: row.engineUsed,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Returns a recent `done` row for the same (workspace, domain), if within TTL. */
export async function findRecentCachedSuggestion(
  workspaceId: string,
  domain: string
): Promise<OnboardingSuggestionRecord | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  const [row] = await db
    .select()
    .from(onboardingSuggestion)
    .where(
      and(
        eq(onboardingSuggestion.workspaceId, workspaceId),
        eq(onboardingSuggestion.domain, domain),
        eq(onboardingSuggestion.status, 'done'),
        gte(onboardingSuggestion.createdAt, cutoff)
      )
    )
    .orderBy(desc(onboardingSuggestion.createdAt))
    .limit(1);
  return row ? rowToRecord(row) : null;
}

/** Returns a still-running row for the same (workspace, domain), if any. */
export async function findInFlightSuggestion(
  workspaceId: string,
  domain: string
): Promise<OnboardingSuggestionRecord | null> {
  const [row] = await db
    .select()
    .from(onboardingSuggestion)
    .where(
      and(
        eq(onboardingSuggestion.workspaceId, workspaceId),
        eq(onboardingSuggestion.domain, domain),
        inArray(onboardingSuggestion.status, IN_FLIGHT_STATUSES)
      )
    )
    .orderBy(desc(onboardingSuggestion.createdAt))
    .limit(1);
  return row ? rowToRecord(row) : null;
}

export async function getSuggestionById(
  workspaceId: string,
  id: string
): Promise<OnboardingSuggestionRecord | null> {
  const [row] = await db
    .select()
    .from(onboardingSuggestion)
    .where(and(eq(onboardingSuggestion.id, id), eq(onboardingSuggestion.workspaceId, workspaceId)))
    .limit(1);
  return row ? rowToRecord(row) : null;
}

export async function createPendingSuggestion(
  workspaceId: string,
  domain: string
): Promise<OnboardingSuggestionRecord> {
  const [row] = await db
    .insert(onboardingSuggestion)
    .values({ workspaceId, domain, status: 'pending' })
    .returning();
  if (!row) throw new Error('Failed to insert onboarding_suggestion row');
  return rowToRecord(row);
}

export type SuggestionUpdate = Partial<{
  status: OnboardingSuggestionStatus;
  error: OnboardingSuggestionError | null;
  extracted: OnboardingSuggestionExtracted | null;
  suggestedCompetitors: OnboardingSuggestionCompetitor[] | null;
  suggestedPrompts: OnboardingSuggestionPrompt[] | null;
  engineUsed: string | null;
  completedAt: Date | null;
}>;

export async function updateSuggestion(id: string, patch: SuggestionUpdate): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(onboardingSuggestion).set(patch).where(eq(onboardingSuggestion.id, id));
}
