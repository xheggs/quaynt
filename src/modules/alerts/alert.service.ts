import { eq, and, desc, count, isNull, isNotNull, gt, gte, lte, sql } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { paginationConfig, sortConfig, countTotal, applyDateRange } from '@/lib/db/query-helpers';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { alertRule, alertEvent } from './alert.schema';
import type {
  AlertRuleCreate,
  AlertRuleUpdate,
  AlertMetric,
  AlertEventFilters,
  AlertSnoozeInput,
  AlertSummary,
} from './alert.types';

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
  const isBrandScoped = input.metric === 'geo_score' || input.metric === 'seo_score';
  const isWorkspaceScoped =
    input.metric.startsWith('crawler_') || input.metric.startsWith('ai_visit');

  if (isBrandScoped && !input.scope.brandId) {
    throw new Error('brandId is required for brand-scoped alert metrics');
  }

  // Validate brand exists in workspace
  const [brandRecord] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, input.scope.brandId), eq(brand.workspaceId, workspaceId)))
    .limit(1);

  if (!brandRecord) {
    throw new Error('Brand not found in this workspace');
  }

  // Validate prompt set exists in workspace (only for prompt-set-scoped metrics)
  if (!isBrandScoped && !isWorkspaceScoped) {
    if (!input.promptSetId) {
      throw new Error('promptSetId is required for this metric');
    }
    const [psRecord] = await db
      .select({ id: promptSet.id })
      .from(promptSet)
      .where(and(eq(promptSet.id, input.promptSetId), eq(promptSet.workspaceId, workspaceId)))
      .limit(1);

    if (!psRecord) {
      throw new Error('Prompt set not found in this workspace');
    }
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
      promptSetId: isBrandScoped || isWorkspaceScoped ? null : input.promptSetId,
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

// ---------------------------------------------------------------------------
// Alert Event Management
// ---------------------------------------------------------------------------

const EVENT_SORT_COLUMNS: Record<string, Column> = {
  severity: alertEvent.severity,
  triggeredAt: alertEvent.triggeredAt,
  acknowledgedAt: alertEvent.acknowledgedAt,
  snoozedUntil: alertEvent.snoozedUntil,
};

export const ALERT_EVENT_ALLOWED_SORTS = Object.keys(EVENT_SORT_COLUMNS);

function deriveEventStatus(event: {
  acknowledgedAt: Date | null;
  snoozedUntil: Date | null;
}): 'active' | 'acknowledged' | 'snoozed' {
  if (event.acknowledgedAt) return 'acknowledged';
  if (event.snoozedUntil && event.snoozedUntil > new Date()) return 'snoozed';
  return 'active';
}

export async function listAlertEvents(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  filters?: AlertEventFilters
) {
  const conditions: SQL[] = [eq(alertEvent.workspaceId, workspaceId)];

  if (filters?.alertRuleId) {
    conditions.push(eq(alertEvent.alertRuleId, filters.alertRuleId));
  }
  if (filters?.severity) {
    conditions.push(eq(alertEvent.severity, filters.severity));
  }
  if (filters?.status === 'active') {
    conditions.push(isNull(alertEvent.acknowledgedAt));
    conditions.push(
      sql`(${alertEvent.snoozedUntil} IS NULL OR ${alertEvent.snoozedUntil} < NOW())`
    );
  } else if (filters?.status === 'acknowledged') {
    conditions.push(isNotNull(alertEvent.acknowledgedAt));
  } else if (filters?.status === 'snoozed') {
    conditions.push(isNotNull(alertEvent.snoozedUntil));
    conditions.push(gt(alertEvent.snoozedUntil, sql`NOW()`));
  }
  if (filters?.from || filters?.to) {
    applyDateRange(conditions, { from: filters?.from, to: filters?.to }, alertEvent.triggeredAt);
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, EVENT_SORT_COLUMNS);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: alertEvent.id,
        alertRuleId: alertEvent.alertRuleId,
        ruleName: alertRule.name,
        workspaceId: alertEvent.workspaceId,
        severity: alertEvent.severity,
        metricValue: alertEvent.metricValue,
        previousValue: alertEvent.previousValue,
        threshold: alertEvent.threshold,
        condition: alertEvent.condition,
        scopeSnapshot: alertEvent.scopeSnapshot,
        triggeredAt: alertEvent.triggeredAt,
        acknowledgedAt: alertEvent.acknowledgedAt,
        snoozedUntil: alertEvent.snoozedUntil,
        createdAt: alertEvent.createdAt,
        updatedAt: alertEvent.updatedAt,
      })
      .from(alertEvent)
      .leftJoin(alertRule, eq(alertEvent.alertRuleId, alertRule.id))
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(alertEvent.triggeredAt))
      .limit(limit)
      .offset(offset),
    countTotal(alertEvent, conditions),
  ]);

  const items = rows.map((row) => ({
    ...row,
    status: deriveEventStatus(row),
  }));

  return { items, total };
}

export async function getAlertEvent(eventId: string, workspaceId: string) {
  const [row] = await db
    .select({
      id: alertEvent.id,
      alertRuleId: alertEvent.alertRuleId,
      ruleName: alertRule.name,
      workspaceId: alertEvent.workspaceId,
      severity: alertEvent.severity,
      metricValue: alertEvent.metricValue,
      previousValue: alertEvent.previousValue,
      threshold: alertEvent.threshold,
      condition: alertEvent.condition,
      scopeSnapshot: alertEvent.scopeSnapshot,
      triggeredAt: alertEvent.triggeredAt,
      acknowledgedAt: alertEvent.acknowledgedAt,
      snoozedUntil: alertEvent.snoozedUntil,
      createdAt: alertEvent.createdAt,
      updatedAt: alertEvent.updatedAt,
    })
    .from(alertEvent)
    .leftJoin(alertRule, eq(alertEvent.alertRuleId, alertRule.id))
    .where(and(eq(alertEvent.id, eventId), eq(alertEvent.workspaceId, workspaceId)))
    .limit(1);

  if (!row) return null;

  return { ...row, status: deriveEventStatus(row) };
}

export async function acknowledgeAlertEvent(eventId: string, workspaceId: string, boss?: PgBoss) {
  // Check if event exists and is in this workspace
  const existing = await getAlertEvent(eventId, workspaceId);
  if (!existing) return null;

  // Idempotent: if already acknowledged, return current state
  if (existing.acknowledgedAt) return existing;

  const now = new Date();
  await db
    .update(alertEvent)
    .set({ acknowledgedAt: now })
    .where(and(eq(alertEvent.id, eventId), eq(alertEvent.workspaceId, workspaceId)));

  const updated = { ...existing, acknowledgedAt: now, status: 'acknowledged' as const };

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'alert.acknowledged',
      {
        alertEventId: eventId,
        alertRuleId: existing.alertRuleId,
        ruleName: existing.ruleName,
        severity: existing.severity,
        acknowledgedAt: now.toISOString(),
      },
      boss
    ).catch(() => {
      // Non-blocking, failure-isolated
    });
  }

  return updated;
}

const MAX_SNOOZE_DURATION_SECONDS = 2_592_000; // 30 days

export async function snoozeAlertEvent(
  eventId: string,
  workspaceId: string,
  input: AlertSnoozeInput
) {
  const hasDuration = input.duration != null;
  const hasUntil = input.snoozedUntil != null;

  if (hasDuration === hasUntil) {
    throw new Error('Provide exactly one of duration (seconds) or snoozedUntil (ISO 8601)');
  }

  let snoozedUntil: Date;

  if (hasDuration) {
    if (input.duration! > MAX_SNOOZE_DURATION_SECONDS) {
      throw new Error('Duration exceeds maximum of 30 days');
    }
    snoozedUntil = new Date(Date.now() + input.duration! * 1000);
  } else {
    snoozedUntil = new Date(input.snoozedUntil!);
    if (snoozedUntil <= new Date()) {
      throw new Error('Snooze time must be in the future');
    }
  }

  // Check if event exists and is in this workspace
  const existing = await getAlertEvent(eventId, workspaceId);
  if (!existing) return null;

  await db
    .update(alertEvent)
    .set({ snoozedUntil })
    .where(and(eq(alertEvent.id, eventId), eq(alertEvent.workspaceId, workspaceId)));

  return { ...existing, snoozedUntil, status: deriveEventStatus({ ...existing, snoozedUntil }) };
}

export async function getAlertSummary(
  workspaceId: string,
  range?: { from?: string; to?: string }
): Promise<AlertSummary> {
  const now = new Date();
  const fromDate = range?.from
    ? new Date(range.from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toDate = range?.to ? new Date(range.to) : now;

  const periodConditions: SQL[] = [
    eq(alertEvent.workspaceId, workspaceId),
    gte(alertEvent.triggeredAt, fromDate),
    lte(alertEvent.triggeredAt, toDate),
  ];

  // Single-pass aggregate counts
  const [counts] = await db
    .select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN ${alertEvent.acknowledgedAt} IS NULL AND (${alertEvent.snoozedUntil} IS NULL OR ${alertEvent.snoozedUntil} < NOW()) THEN 1 ELSE 0 END)`,
      acknowledged: sql<number>`SUM(CASE WHEN ${alertEvent.acknowledgedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      snoozed: sql<number>`SUM(CASE WHEN ${alertEvent.snoozedUntil} IS NOT NULL AND ${alertEvent.snoozedUntil} > NOW() AND ${alertEvent.acknowledgedAt} IS NULL THEN 1 ELSE 0 END)`,
      info: sql<number>`SUM(CASE WHEN ${alertEvent.severity} = 'info' THEN 1 ELSE 0 END)`,
      warning: sql<number>`SUM(CASE WHEN ${alertEvent.severity} = 'warning' THEN 1 ELSE 0 END)`,
      critical: sql<number>`SUM(CASE WHEN ${alertEvent.severity} = 'critical' THEN 1 ELSE 0 END)`,
    })
    .from(alertEvent)
    .where(and(...periodConditions));

  // Top 5 rules by event count
  const topRules = await db
    .select({
      ruleId: alertEvent.alertRuleId,
      ruleName: alertRule.name,
      count: count(),
    })
    .from(alertEvent)
    .leftJoin(alertRule, eq(alertEvent.alertRuleId, alertRule.id))
    .where(and(...periodConditions))
    .groupBy(alertEvent.alertRuleId, alertRule.name)
    .orderBy(desc(count()))
    .limit(5);

  return {
    total: Number(counts?.total ?? 0),
    active: Number(counts?.active ?? 0),
    acknowledged: Number(counts?.acknowledged ?? 0),
    snoozed: Number(counts?.snoozed ?? 0),
    bySeverity: {
      info: Number(counts?.info ?? 0),
      warning: Number(counts?.warning ?? 0),
      critical: Number(counts?.critical ?? 0),
    },
    topRules: topRules.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      count: Number(r.count),
    })),
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  };
}
