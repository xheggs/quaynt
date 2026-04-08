import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { modelRun } from '@/modules/model-runs/model-run.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import type { DashboardPromptSet } from './dashboard.types';

export interface ResolvedContext {
  workspaceId: string;
  promptSetId: string;
  promptSetName: string;
  from: string;
  to: string;
  brandMap: Map<string, string>;
}

const DEFAULT_PERIOD_DAYS = 29;

export async function resolvePromptSet(
  workspaceId: string,
  promptSetId?: string
): Promise<DashboardPromptSet | null> {
  if (promptSetId) {
    const [row] = await db
      .select({ id: promptSet.id, name: promptSet.name })
      .from(promptSet)
      .where(
        and(
          eq(promptSet.id, promptSetId),
          eq(promptSet.workspaceId, workspaceId),
          isNull(promptSet.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  }

  // Auto-resolve: find the prompt set with the most recent completed model run
  const [row] = await db
    .select({ id: promptSet.id, name: promptSet.name })
    .from(modelRun)
    .innerJoin(promptSet, eq(modelRun.promptSetId, promptSet.id))
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        inArray(modelRun.status, ['completed', 'partial']),
        isNull(promptSet.deletedAt)
      )
    )
    .orderBy(desc(modelRun.completedAt))
    .limit(1);

  return row ?? null;
}

export async function resolveDataAsOf(workspaceId: string, promptSetId: string): Promise<string> {
  const [row] = await db
    .select({ completedAt: modelRun.completedAt })
    .from(modelRun)
    .where(
      and(
        eq(modelRun.workspaceId, workspaceId),
        eq(modelRun.promptSetId, promptSetId),
        inArray(modelRun.status, ['completed', 'partial'])
      )
    )
    .orderBy(desc(modelRun.completedAt))
    .limit(1);

  return row?.completedAt?.toISOString() ?? new Date().toISOString();
}

export function resolveDefaultDates(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (from && to) return { from, to };
  if (from && !to) return { from, to: todayStr };
  if (!from && to) {
    const d = new Date(to);
    d.setDate(d.getDate() - DEFAULT_PERIOD_DAYS);
    return { from: d.toISOString().slice(0, 10), to };
  }

  const d = new Date(now);
  d.setDate(d.getDate() - DEFAULT_PERIOD_DAYS);
  return { from: d.toISOString().slice(0, 10), to: todayStr };
}
