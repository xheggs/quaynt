import type { PgBoss } from 'pg-boss';
import { eq, and, lt, desc, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeDelta } from '@/modules/visibility/trend.stats';
import { recommendationShare } from '@/modules/visibility/recommendation-share.schema';
import { sentimentAggregate } from '@/modules/visibility/sentiment-aggregate.schema';
import { positionAggregate } from '@/modules/visibility/position-aggregate.schema';
import { crawlerDailyAggregate } from '@/modules/crawler/crawler-aggregate.schema';
import {
  dispatchAlertEmail,
  dispatchAlertWebhook,
} from '@/modules/notifications/notification.service';
import { alertRule, alertEvent } from './alert.schema';
import type {
  AlertMetric,
  AlertCondition,
  AlertDirection,
  AlertScope,
  AlertEvaluationResult,
} from './alert.types';

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

export async function resolveMetricValue(
  metric: AlertMetric,
  workspaceId: string,
  promptSetId: string | null,
  scope: AlertScope,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  // Crawler metrics are workspace-scoped — no promptSetId or brandId needed
  if (metric === 'crawler_visit_count') {
    return resolveFromCrawlerVisitCount(workspaceId, scope.botName, date);
  }
  if (metric === 'crawler_bot_activity') {
    return resolveFromCrawlerBotActivity(workspaceId, scope.botName, date);
  }

  // Non-crawler metrics require promptSetId
  if (!promptSetId) {
    return { currentValue: null, previousValue: null };
  }

  const platformId = scope.platformId ?? '_all';
  const locale = scope.locale ?? '_all';
  const { brandId } = scope;

  switch (metric) {
    case 'recommendation_share':
      return resolveFromRecommendationShare(
        workspaceId,
        promptSetId,
        brandId,
        platformId,
        locale,
        date,
        'sharePercentage'
      );

    case 'citation_count':
      return resolveFromRecommendationShare(
        workspaceId,
        promptSetId,
        brandId,
        platformId,
        locale,
        date,
        'citationCount'
      );

    case 'sentiment_score':
      return resolveFromSentimentAggregate(
        workspaceId,
        promptSetId,
        brandId,
        platformId,
        locale,
        date
      );

    case 'position_average':
      return resolveFromPositionAggregate(
        workspaceId,
        promptSetId,
        brandId,
        platformId,
        locale,
        date
      );
  }
}

async function resolveFromRecommendationShare(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  platformId: string,
  locale: string,
  date: string,
  column: 'sharePercentage' | 'citationCount'
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  const scopeConditions = [
    eq(recommendationShare.workspaceId, workspaceId),
    eq(recommendationShare.promptSetId, promptSetId),
    eq(recommendationShare.brandId, brandId),
    eq(recommendationShare.platformId, platformId),
    eq(recommendationShare.locale, locale),
  ];

  const [current] = await db
    .select({
      sharePercentage: recommendationShare.sharePercentage,
      citationCount: recommendationShare.citationCount,
    })
    .from(recommendationShare)
    .where(and(...scopeConditions, eq(recommendationShare.periodStart, date)))
    .limit(1);

  const [previous] = await db
    .select({
      sharePercentage: recommendationShare.sharePercentage,
      citationCount: recommendationShare.citationCount,
    })
    .from(recommendationShare)
    .where(and(...scopeConditions, lt(recommendationShare.periodStart, date)))
    .orderBy(desc(recommendationShare.periodStart))
    .limit(1);

  return {
    currentValue: current ? Number(current[column]) : null,
    previousValue: previous ? Number(previous[column]) : null,
  };
}

async function resolveFromSentimentAggregate(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  platformId: string,
  locale: string,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  const scopeConditions = [
    eq(sentimentAggregate.workspaceId, workspaceId),
    eq(sentimentAggregate.promptSetId, promptSetId),
    eq(sentimentAggregate.brandId, brandId),
    eq(sentimentAggregate.platformId, platformId),
    eq(sentimentAggregate.locale, locale),
  ];

  const [current] = await db
    .select({ netSentimentScore: sentimentAggregate.netSentimentScore })
    .from(sentimentAggregate)
    .where(and(...scopeConditions, eq(sentimentAggregate.periodStart, date)))
    .limit(1);

  const [previous] = await db
    .select({ netSentimentScore: sentimentAggregate.netSentimentScore })
    .from(sentimentAggregate)
    .where(and(...scopeConditions, lt(sentimentAggregate.periodStart, date)))
    .orderBy(desc(sentimentAggregate.periodStart))
    .limit(1);

  return {
    currentValue: current ? Number(current.netSentimentScore) : null,
    previousValue: previous ? Number(previous.netSentimentScore) : null,
  };
}

async function resolveFromPositionAggregate(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  platformId: string,
  locale: string,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  const scopeConditions = [
    eq(positionAggregate.workspaceId, workspaceId),
    eq(positionAggregate.promptSetId, promptSetId),
    eq(positionAggregate.brandId, brandId),
    eq(positionAggregate.platformId, platformId),
    eq(positionAggregate.locale, locale),
  ];

  const [current] = await db
    .select({ averagePosition: positionAggregate.averagePosition })
    .from(positionAggregate)
    .where(and(...scopeConditions, eq(positionAggregate.periodStart, date)))
    .limit(1);

  const [previous] = await db
    .select({ averagePosition: positionAggregate.averagePosition })
    .from(positionAggregate)
    .where(and(...scopeConditions, lt(positionAggregate.periodStart, date)))
    .orderBy(desc(positionAggregate.periodStart))
    .limit(1);

  return {
    currentValue: current ? Number(current.averagePosition) : null,
    previousValue: previous ? Number(previous.averagePosition) : null,
  };
}

async function resolveFromCrawlerVisitCount(
  workspaceId: string,
  botName: string | undefined,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  const targetBot = botName ?? '_all_';

  const [current] = await db
    .select({ visitCount: crawlerDailyAggregate.visitCount })
    .from(crawlerDailyAggregate)
    .where(
      and(
        eq(crawlerDailyAggregate.workspaceId, workspaceId),
        eq(crawlerDailyAggregate.botName, targetBot),
        eq(crawlerDailyAggregate.periodStart, date)
      )
    )
    .limit(1);

  const [previous] = await db
    .select({ visitCount: crawlerDailyAggregate.visitCount })
    .from(crawlerDailyAggregate)
    .where(
      and(
        eq(crawlerDailyAggregate.workspaceId, workspaceId),
        eq(crawlerDailyAggregate.botName, targetBot),
        lt(crawlerDailyAggregate.periodStart, date)
      )
    )
    .orderBy(desc(crawlerDailyAggregate.periodStart))
    .limit(1);

  return {
    currentValue: current?.visitCount ?? null,
    previousValue: previous?.visitCount ?? null,
  };
}

async function resolveFromCrawlerBotActivity(
  workspaceId: string,
  botName: string | undefined,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  // Returns the number of consecutive days with zero visits for the specified bot.
  // currentValue = consecutive zero-visit days (0 means active today).
  const targetBot = botName ?? '_all_';

  // Check if there's data for today
  const [current] = await db
    .select({ visitCount: crawlerDailyAggregate.visitCount })
    .from(crawlerDailyAggregate)
    .where(
      and(
        eq(crawlerDailyAggregate.workspaceId, workspaceId),
        eq(crawlerDailyAggregate.botName, targetBot),
        eq(crawlerDailyAggregate.periodStart, date)
      )
    )
    .limit(1);

  const currentVisits = current?.visitCount ?? 0;

  // Find last date with visits
  const [lastActive] = await db
    .select({ periodStart: crawlerDailyAggregate.periodStart })
    .from(crawlerDailyAggregate)
    .where(
      and(
        eq(crawlerDailyAggregate.workspaceId, workspaceId),
        eq(crawlerDailyAggregate.botName, targetBot),
        sql`${crawlerDailyAggregate.visitCount} > 0`
      )
    )
    .orderBy(desc(crawlerDailyAggregate.periodStart))
    .limit(1);

  let daysSinceActive = 0;
  if (lastActive) {
    const lastDate = new Date(lastActive.periodStart);
    const currentDate = new Date(date);
    daysSinceActive = Math.floor(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    currentValue: currentVisits > 0 ? 0 : daysSinceActive,
    previousValue: null,
  };
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

  // Load all enabled rules for this workspace + metric + promptSet
  const isCrawlerMetric = metric.startsWith('crawler_');
  const ruleConditions = [
    eq(alertRule.workspaceId, workspaceId),
    eq(alertRule.metric, metric),
    eq(alertRule.enabled, true),
  ];
  if (!isCrawlerMetric && promptSetId) {
    ruleConditions.push(eq(alertRule.promptSetId, promptSetId));
  } else if (isCrawlerMetric) {
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
