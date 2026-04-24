import type { PgBoss } from 'pg-boss';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeDelta } from '@/modules/visibility/trend.stats';
import {
  dispatchAlertEmail,
  dispatchAlertWebhook,
} from '@/modules/notifications/notification.service';
import { alertRule, alertEvent } from './alert.schema';
import { resolveMetricValue } from './alert.metrics';
import type {
  AlertMetric,
  AlertCondition,
  AlertDirection,
  AlertScope,
  AlertEvaluationResult,
} from './alert.types';

export { resolveMetricValue } from './alert.metrics';

export function evaluateCondition(
  condition: AlertCondition,
  currentValue: number,
  previousValue: number | null,
  threshold: number,
  direction: AlertDirection
): { conditionMet: boolean; delta?: number; changeRate?: number | null } {
  switch (condition) {
    case 'drops_below':
      return { conditionMet: currentValue < threshold };

    case 'exceeds':
      return { conditionMet: currentValue > threshold };

    case 'changes_by_percent': {
      if (previousValue === null) return { conditionMet: false };
      const { delta, changeRate } = computeDelta(currentValue, previousValue);
      if (changeRate === null) return { conditionMet: false, delta, changeRate };

      let conditionMet: boolean;
      switch (direction) {
        case 'decrease':
          conditionMet = changeRate <= -threshold;
          break;
        case 'increase':
          conditionMet = changeRate >= threshold;
          break;
        default: // 'any'
          conditionMet = Math.abs(changeRate) >= threshold;
          break;
      }
      return { conditionMet, delta, changeRate };
    }

    case 'changes_by_absolute': {
      if (previousValue === null) return { conditionMet: false };
      const { delta, changeRate } = computeDelta(currentValue, previousValue);

      let conditionMet: boolean;
      switch (direction) {
        case 'decrease':
          conditionMet = delta <= -threshold;
          break;
        case 'increase':
          conditionMet = delta >= threshold;
          break;
        default: // 'any'
          conditionMet = Math.abs(delta) >= threshold;
          break;
      }
      return { conditionMet, delta, changeRate };
    }
  }
}

export function isCooldownActive(
  lastTriggeredAt: Date | null,
  cooldownMinutes: number,
  now: Date = new Date()
): boolean {
  if (!lastTriggeredAt) return false;
  const cooldownExpiry = new Date(lastTriggeredAt.getTime() + cooldownMinutes * 60_000);
  return now < cooldownExpiry;
}

export async function evaluateRulesForMetric(
  workspaceId: string,
  promptSetId: string | null,
  metric: AlertMetric,
  date: string,
  boss: PgBoss
): Promise<AlertEvaluationResult[]> {
  const log = logger.child({ workspaceId, promptSetId, metric, date });
  const results: AlertEvaluationResult[] = [];

  // Load all enabled rules for this workspace + metric + promptSet. Workspace-scoped
  // metrics (crawler and AI traffic) and brand-scoped metrics (geo_score, seo_score)
  // don't carry a promptSetId and match on `is null`.
  const BRAND_SCOPED_METRICS = new Set<AlertMetric>(['geo_score', 'seo_score']);
  const isBrandScopedMetric = BRAND_SCOPED_METRICS.has(metric);
  const isWorkspaceMetric = metric.startsWith('crawler_') || metric.startsWith('ai_visit');
  const isPromptSetScopedMetric = !isWorkspaceMetric && !isBrandScopedMetric;
  const ruleConditions = [
    eq(alertRule.workspaceId, workspaceId),
    eq(alertRule.metric, metric),
    eq(alertRule.enabled, true),
  ];
  if (isPromptSetScopedMetric && promptSetId) {
    ruleConditions.push(eq(alertRule.promptSetId, promptSetId));
  } else if (isWorkspaceMetric || isBrandScopedMetric) {
    ruleConditions.push(isNull(alertRule.promptSetId));
  }

  const rules = await db
    .select()
    .from(alertRule)
    .where(and(...ruleConditions));

  if (rules.length === 0) {
    log.debug('No enabled alert rules found');
    return results;
  }

  for (const rule of rules) {
    const scope = rule.scope as AlertScope;

    // Resolve metric values
    const { currentValue, previousValue } = await resolveMetricValue(
      metric,
      workspaceId,
      promptSetId,
      scope,
      date
    );

    if (currentValue === null) {
      results.push({
        ruleId: rule.id,
        conditionMet: false,
        currentValue: 0,
        previousValue,
        reason: 'insufficient_data',
      });

      // Update lastEvaluatedAt even for insufficient data
      await db
        .update(alertRule)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(alertRule.id, rule.id));

      continue;
    }

    // Check cooldown
    if (isCooldownActive(rule.lastTriggeredAt, rule.cooldownMinutes)) {
      results.push({
        ruleId: rule.id,
        conditionMet: true,
        currentValue,
        previousValue,
        reason: 'cooldown_active',
      });

      await db
        .update(alertRule)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(alertRule.id, rule.id));

      continue;
    }

    // Evaluate condition
    const direction = (rule.direction ?? 'any') as AlertDirection;
    const condition = rule.condition as AlertCondition;
    const threshold = Number(rule.threshold);
    const { conditionMet } = evaluateCondition(
      condition,
      currentValue,
      previousValue,
      threshold,
      direction
    );

    if (!conditionMet) {
      results.push({
        ruleId: rule.id,
        conditionMet: false,
        currentValue,
        previousValue,
        reason: 'condition_not_met',
      });

      await db
        .update(alertRule)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(alertRule.id, rule.id));

      continue;
    }

    // Condition met and cooldown expired — create alert event in a transaction
    const now = new Date();
    const [event] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(alertEvent)
        .values({
          alertRuleId: rule.id,
          workspaceId,
          severity: rule.severity,
          metricValue: String(currentValue),
          previousValue: previousValue !== null ? String(previousValue) : null,
          threshold: rule.threshold,
          condition: rule.condition,
          scopeSnapshot: scope,
          triggeredAt: now,
        })
        .returning();

      await tx
        .update(alertRule)
        .set({ lastTriggeredAt: now, lastEvaluatedAt: now })
        .where(eq(alertRule.id, rule.id));

      return created;
    });

    results.push({
      ruleId: rule.id,
      conditionMet: true,
      currentValue,
      previousValue,
      reason: 'triggered',
    });

    // Dispatch webhook outside the transaction (non-blocking)
    try {
      await dispatchAlertWebhook(event, rule, boss);
    } catch (err) {
      log.warn(
        { error: err instanceof Error ? err.message : String(err), ruleId: rule.id },
        'Failed to dispatch alert.triggered webhook'
      );
    }

    // Dispatch email notification outside the transaction (non-blocking)
    try {
      await dispatchAlertEmail(event, rule, boss);
    } catch (err) {
      log.warn(
        { error: err instanceof Error ? err.message : String(err), ruleId: rule.id },
        'Failed to dispatch alert email notification'
      );
    }
  }

  const triggered = results.filter((r) => r.reason === 'triggered').length;
  log.info(
    { total: rules.length, triggered, skipped: rules.length - triggered },
    'Alert evaluation complete'
  );

  return results;
}
