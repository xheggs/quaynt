import { eq, and, desc, count } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { alertRule } from './alert.schema';
import type { AlertRuleCreate, AlertRuleUpdate, AlertMetric } from './alert.types';

const SORT_COLUMNS: Record<string, Column> = {
  name: alertRule.name,
  metric: alertRule.metric,
  severity: alertRule.severity,
  enabled: alertRule.enabled,
  createdAt: alertRule.createdAt,
  lastTriggeredAt: alertRule.lastTriggeredAt,
};

export const ALERT_RULE_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

export async function createAlertRule(workspaceId: string, input: AlertRuleCreate) {
  // Validate brand exists in workspace
  const [brandRecord] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, input.scope.brandId), eq(brand.workspaceId, workspaceId)))
    .limit(1);

  if (!brandRecord) {
    throw new Error('Brand not found in this workspace');
  }

  // Validate prompt set exists in workspace
  const [psRecord] = await db
    .select({ id: promptSet.id })
    .from(promptSet)
    .where(and(eq(promptSet.id, input.promptSetId), eq(promptSet.workspaceId, workspaceId)))
    .limit(1);

  if (!psRecord) {
    throw new Error('Prompt set not found in this workspace');
  }

  // Check per-workspace rule limit
  const [{ ruleCount }] = await db
    .select({ ruleCount: count() })
    .from(alertRule)
    .where(eq(alertRule.workspaceId, workspaceId));

  if (ruleCount >= env.ALERT_MAX_RULES_PER_WORKSPACE) {
    throw new Error(
      `Workspace alert rule limit reached (max ${env.ALERT_MAX_RULES_PER_WORKSPACE})`
    );
  }

  const [created] = await db
    .insert(alertRule)
    .values({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      metric: input.metric,
      promptSetId: input.promptSetId,
      scope: input.scope,
      condition: input.condition,
      threshold: String(input.threshold),
      direction: input.direction ?? 'any',
      cooldownMinutes: input.cooldownMinutes ?? 60,
      severity: input.severity ?? 'warning',
      enabled: input.enabled ?? true,
    })
    .returning();

  return created;
}

export async function listAlertRules(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  filters?: { metric?: AlertMetric; enabled?: boolean }
) {
  const conditions: SQL[] = [eq(alertRule.workspaceId, workspaceId)];

  if (filters?.metric) {
    conditions.push(eq(alertRule.metric, filters.metric));
  }
  if (filters?.enabled !== undefined) {
    conditions.push(eq(alertRule.enabled, filters.enabled));
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select()
      .from(alertRule)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(alertRule.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(alertRule, conditions),
  ]);

  return { items, total };
}

export async function getAlertRule(ruleId: string, workspaceId: string) {
  const [record] = await db
    .select()
    .from(alertRule)
    .where(and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)))
    .limit(1);

  return record ?? null;
}

export async function updateAlertRule(ruleId: string, workspaceId: string, input: AlertRuleUpdate) {
  // Reject immutable field changes
  if ('metric' in input && input.metric !== undefined) {
    throw new Error('Cannot change metric after rule creation');
  }
  if ('promptSetId' in input && (input as { promptSetId?: string }).promptSetId !== undefined) {
    throw new Error('Cannot change promptSetId after rule creation');
  }

  // Validate updated brandId if scope is being changed
  if (input.scope?.brandId) {
    const [brandRecord] = await db
      .select({ id: brand.id })
      .from(brand)
      .where(and(eq(brand.id, input.scope.brandId), eq(brand.workspaceId, workspaceId)))
      .limit(1);

    if (!brandRecord) {
      throw new Error('Brand not found in this workspace');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.scope !== undefined) updateData.scope = input.scope;
  if (input.condition !== undefined) updateData.condition = input.condition;
  if (input.threshold !== undefined) updateData.threshold = String(input.threshold);
  if (input.direction !== undefined) updateData.direction = input.direction;
  if (input.cooldownMinutes !== undefined) updateData.cooldownMinutes = input.cooldownMinutes;
  if (input.severity !== undefined) updateData.severity = input.severity;
  if (input.enabled !== undefined) updateData.enabled = input.enabled;

  const [updated] = await db
    .update(alertRule)
    .set(updateData)
    .where(and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)))
    .returning();

  return updated ?? null;
}

export async function deleteAlertRule(ruleId: string, workspaceId: string) {
  const [deleted] = await db
    .delete(alertRule)
    .where(and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)))
    .returning({ id: alertRule.id });

  return !!deleted;
}
