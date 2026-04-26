import { eq, and, desc, asc, isNull, ilike, arrayOverlaps, count, sql } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { promptSet } from './prompt-set.schema';
import { prompt } from './prompt.schema';
import { STARTER_PROMPT_SET } from './seed/starter-prompt-set';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SORT_COLUMNS = {
  createdAt: promptSet.createdAt,
  name: promptSet.name,
};

export const PROMPT_SET_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

export async function createPromptSet(
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    tags?: string[];
  },
  boss?: PgBoss
) {
  const existing = await db
    .select({ id: promptSet.id })
    .from(promptSet)
    .where(
      and(
        eq(promptSet.workspaceId, workspaceId),
        eq(promptSet.name, input.name),
        isNull(promptSet.deletedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Prompt set name already exists in this workspace');
  }

  const [created] = await db
    .insert(promptSet)
    .values({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      tags: input.tags ?? [],
    })
    .returning({
      id: promptSet.id,
      name: promptSet.name,
      description: promptSet.description,
      tags: promptSet.tags,
      createdAt: promptSet.createdAt,
      updatedAt: promptSet.updatedAt,
    });

  if (boss) {
    await dispatchWebhookEvent(workspaceId, 'prompt_set.created', { promptSet: created }, boss);
  }

  return created;
}

export async function listPromptSets(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  filters?: { search?: string; tag?: string }
) {
  const conditions = [eq(promptSet.workspaceId, workspaceId), isNull(promptSet.deletedAt)];

  if (filters?.search) {
    conditions.push(ilike(promptSet.name, `%${filters.search}%`));
  }

  if (filters?.tag) {
    conditions.push(arrayOverlaps(promptSet.tags, [filters.tag]));
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: promptSet.id,
        name: promptSet.name,
        description: promptSet.description,
        tags: promptSet.tags,
        createdAt: promptSet.createdAt,
        updatedAt: promptSet.updatedAt,
      })
      .from(promptSet)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(promptSet.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(promptSet, conditions),
  ]);

  return { items, total };
}

export async function getPromptSet(promptSetId: string, workspaceId: string) {
  const [record] = await db
    .select({
      id: promptSet.id,
      name: promptSet.name,
      description: promptSet.description,
      tags: promptSet.tags,
      createdAt: promptSet.createdAt,
      updatedAt: promptSet.updatedAt,
    })
    .from(promptSet)
    .where(
      and(
        eq(promptSet.id, promptSetId),
        eq(promptSet.workspaceId, workspaceId),
        isNull(promptSet.deletedAt)
      )
    )
    .limit(1);

  if (!record) return null;

  const [promptCount] = await db
    .select({ count: count() })
    .from(prompt)
    .where(eq(prompt.promptSetId, promptSetId));

  return { ...record, promptCount: promptCount?.count ?? 0 };
}

export async function updatePromptSet(
  promptSetId: string,
  workspaceId: string,
  input: {
    name?: string;
    description?: string | null;
    tags?: string[];
  },
  boss?: PgBoss
) {
  if (input.name) {
    const existing = await db
      .select({ id: promptSet.id })
      .from(promptSet)
      .where(
        and(
          eq(promptSet.workspaceId, workspaceId),
          eq(promptSet.name, input.name),
          isNull(promptSet.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].id !== promptSetId) {
      throw new Error('Prompt set name already exists in this workspace');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.tags !== undefined) updateData.tags = input.tags;

  const [updated] = await db
    .update(promptSet)
    .set(updateData)
    .where(
      and(
        eq(promptSet.id, promptSetId),
        eq(promptSet.workspaceId, workspaceId),
        isNull(promptSet.deletedAt)
      )
    )
    .returning({
      id: promptSet.id,
      name: promptSet.name,
      description: promptSet.description,
      tags: promptSet.tags,
      createdAt: promptSet.createdAt,
      updatedAt: promptSet.updatedAt,
    });

  if (!updated) return null;

  if (boss) {
    await dispatchWebhookEvent(workspaceId, 'prompt_set.updated', { promptSet: updated }, boss);
  }

  return updated;
}

export async function deletePromptSet(promptSetId: string, workspaceId: string, boss?: PgBoss) {
  const now = new Date();

  const [deleted] = await db
    .update(promptSet)
    .set({ deletedAt: now })
    .where(
      and(
        eq(promptSet.id, promptSetId),
        eq(promptSet.workspaceId, workspaceId),
        isNull(promptSet.deletedAt)
      )
    )
    .returning({
      id: promptSet.id,
      name: promptSet.name,
    });

  if (!deleted) return false;

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'prompt_set.deleted',
      { promptSet: { ...deleted, deletedAt: now.toISOString() } },
      boss
    );
  }

  return true;
}

/**
 * Idempotently seed the starter prompt set + its prompts for a workspace.
 * Returns the (existing or newly created) prompt set id. Designed to run
 * inside the auth-hook's signup transaction; the caller passes its `tx`.
 */
export async function seedStarter(tx: Tx, workspaceId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: promptSet.id })
    .from(promptSet)
    .where(
      and(
        eq(promptSet.workspaceId, workspaceId),
        eq(promptSet.name, STARTER_PROMPT_SET.name),
        isNull(promptSet.deletedAt)
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [created] = await tx
    .insert(promptSet)
    .values({
      workspaceId,
      name: STARTER_PROMPT_SET.name,
      description: STARTER_PROMPT_SET.description,
      tags: [],
    })
    .returning({ id: promptSet.id });

  await tx.insert(prompt).values(
    STARTER_PROMPT_SET.prompts.map((template, index) => ({
      promptSetId: created.id,
      template,
      order: index,
    }))
  );

  return created.id;
}

// --- Prompt sub-resource functions ---

async function getActivePromptSet(promptSetId: string, workspaceId: string) {
  const [record] = await db
    .select({ id: promptSet.id })
    .from(promptSet)
    .where(
      and(
        eq(promptSet.id, promptSetId),
        eq(promptSet.workspaceId, workspaceId),
        isNull(promptSet.deletedAt)
      )
    )
    .limit(1);

  return record ?? null;
}

function bumpPromptSetUpdatedAt(promptSetId: string) {
  return db.update(promptSet).set({ updatedAt: new Date() }).where(eq(promptSet.id, promptSetId));
}

export async function listPrompts(promptSetId: string, workspaceId: string) {
  const set = await getActivePromptSet(promptSetId, workspaceId);
  if (!set) return null;

  const items = await db
    .select({
      id: prompt.id,
      promptSetId: prompt.promptSetId,
      template: prompt.template,
      order: prompt.order,
      createdAt: prompt.createdAt,
    })
    .from(prompt)
    .where(eq(prompt.promptSetId, promptSetId))
    .orderBy(asc(prompt.order));

  return items;
}

export async function addPrompt(
  promptSetId: string,
  workspaceId: string,
  input: { template: string; order?: number }
) {
  const set = await getActivePromptSet(promptSetId, workspaceId);
  if (!set) return null;

  // Check prompt count limit
  const [countResult] = await db
    .select({ count: count() })
    .from(prompt)
    .where(eq(prompt.promptSetId, promptSetId));

  if ((countResult?.count ?? 0) >= 500) {
    throw new Error('Prompt set has reached the maximum of 500 prompts');
  }

  let orderValue = input.order;
  if (orderValue === undefined) {
    const [maxOrder] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${prompt.order}), -1)` })
      .from(prompt)
      .where(eq(prompt.promptSetId, promptSetId));
    orderValue = (maxOrder?.maxOrder ?? -1) + 1;
  }

  const [created] = await db
    .insert(prompt)
    .values({
      promptSetId,
      template: input.template,
      order: orderValue,
    })
    .returning({
      id: prompt.id,
      promptSetId: prompt.promptSetId,
      template: prompt.template,
      order: prompt.order,
      createdAt: prompt.createdAt,
    });

  await bumpPromptSetUpdatedAt(promptSetId);

  return created;
}

export async function updatePrompt(
  promptId: string,
  promptSetId: string,
  workspaceId: string,
  input: { template?: string; order?: number }
) {
  const set = await getActivePromptSet(promptSetId, workspaceId);
  if (!set) return null;

  const updateData: Record<string, unknown> = {};
  if (input.template !== undefined) updateData.template = input.template;
  if (input.order !== undefined) updateData.order = input.order;

  const [updated] = await db
    .update(prompt)
    .set(updateData)
    .where(and(eq(prompt.id, promptId), eq(prompt.promptSetId, promptSetId)))
    .returning({
      id: prompt.id,
      promptSetId: prompt.promptSetId,
      template: prompt.template,
      order: prompt.order,
      createdAt: prompt.createdAt,
    });

  if (!updated) return null;

  await bumpPromptSetUpdatedAt(promptSetId);

  return updated;
}

export async function deletePrompt(promptId: string, promptSetId: string, workspaceId: string) {
  const set = await getActivePromptSet(promptSetId, workspaceId);
  if (!set) return null;

  const [deleted] = await db
    .delete(prompt)
    .where(and(eq(prompt.id, promptId), eq(prompt.promptSetId, promptSetId)))
    .returning({ id: prompt.id });

  if (!deleted) return false;

  await bumpPromptSetUpdatedAt(promptSetId);

  return true;
}

export async function reorderPrompts(
  promptSetId: string,
  workspaceId: string,
  promptIds: string[]
) {
  const set = await getActivePromptSet(promptSetId, workspaceId);
  if (!set) return null;

  const existingPrompts = await db
    .select({ id: prompt.id })
    .from(prompt)
    .where(eq(prompt.promptSetId, promptSetId));

  const existingIds = new Set(existingPrompts.map((p) => p.id));
  const providedIds = new Set(promptIds);

  if (
    existingIds.size !== providedIds.size ||
    [...existingIds].some((id) => !providedIds.has(id))
  ) {
    throw new Error('Prompt IDs do not match the prompts in this set');
  }

  for (let i = 0; i < promptIds.length; i++) {
    await db.update(prompt).set({ order: i }).where(eq(prompt.id, promptIds[i]));
  }

  await bumpPromptSetUpdatedAt(promptSetId);

  return true;
}
