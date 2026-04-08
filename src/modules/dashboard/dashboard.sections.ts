import { eq, and, gte, lte, desc, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { computeComparisonDates } from '@/modules/visibility/comparison.utils';
import { computeDelta } from '@/modules/visibility/trend.stats';
import { listAdapterConfigs } from '@/modules/adapters/adapter.service';
import { getAlertSummary } from '@/modules/alerts/alert.service';
import { recommendationShare } from '@/modules/visibility/recommendation-share.schema';
import { opportunity } from '@/modules/visibility/opportunity.schema';
import { alertEvent } from '@/modules/alerts/alert.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import type {
  DashboardMover,
  DashboardOpportunity,
  PlatformStatus,
  DashboardAlertSummary,
} from './dashboard.types';
import type { ResolvedContext } from './dashboard.context';

const ALL_SENTINEL = '_all';
const MAX_MOVERS = 5;
const MAX_OPPORTUNITIES = 5;
const MAX_RECENT_ALERTS = 5;

// --- Top Movers ---

export async function getTopMovers(ctx: ResolvedContext): Promise<DashboardMover[]> {
  const { workspaceId, promptSetId, from, to, brandMap } = ctx;
  const brandIds = Array.from(brandMap.keys());

  if (brandIds.length === 0) return [];

  const { compFrom, compTo } = computeComparisonDates(from, to, 'previous_period');

  // Current period: aggregate per brand
  const currentRows = await db
    .select({
      brandId: recommendationShare.brandId,
      totalWeightedShare: sql<string>`sum(${recommendationShare.sharePercentage}::numeric * ${recommendationShare.citationCount})`,
      totalCitations: sql<number>`sum(${recommendationShare.citationCount})`,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, from),
        lte(recommendationShare.periodStart, to)
      )
    )
    .groupBy(recommendationShare.brandId);

  // Previous period: aggregate per brand
  const prevRows = await db
    .select({
      brandId: recommendationShare.brandId,
      totalWeightedShare: sql<string>`sum(${recommendationShare.sharePercentage}::numeric * ${recommendationShare.citationCount})`,
      totalCitations: sql<number>`sum(${recommendationShare.citationCount})`,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, compFrom),
        lte(recommendationShare.periodStart, compTo)
      )
    )
    .groupBy(recommendationShare.brandId);

  const currentMap = new Map(
    currentRows.map((r) => [
      r.brandId,
      r.totalCitations > 0 ? Number(r.totalWeightedShare) / r.totalCitations : 0,
    ])
  );
  const prevMap = new Map(
    prevRows.map((r) => [
      r.brandId,
      r.totalCitations > 0 ? Number(r.totalWeightedShare) / r.totalCitations : 0,
    ])
  );

  const movers: DashboardMover[] = [];

  for (const brandId of brandIds) {
    const current = currentMap.get(brandId) ?? 0;
    const previous = prevMap.get(brandId) ?? 0;

    if (current === 0 && previous === 0) continue;

    const result = computeDelta(current, previous);
    const brandName = brandMap.get(brandId) ?? '';

    movers.push({
      brandId,
      brandName,
      metric: 'recommendation_share',
      current: current.toFixed(2),
      previous: previous.toFixed(2),
      delta: result.delta.toFixed(2),
      direction: previous === 0 && current === 0 ? null : result.direction,
    });
  }

  movers.sort((a, b) => Math.abs(Number(b.delta)) - Math.abs(Number(a.delta)));
  return movers.slice(0, MAX_MOVERS);
}

// --- Top Opportunities ---

export async function getTopOpportunities(ctx: ResolvedContext): Promise<DashboardOpportunity[]> {
  const { workspaceId, promptSetId, from, to, brandMap } = ctx;
  const brandIds = Array.from(brandMap.keys());

  if (brandIds.length === 0) return [];

  const rows = await db
    .select({
      brandId: opportunity.brandId,
      promptId: opportunity.promptId,
      type: opportunity.type,
      competitorCount: opportunity.competitorCount,
    })
    .from(opportunity)
    .where(
      and(
        eq(opportunity.workspaceId, workspaceId),
        eq(opportunity.promptSetId, promptSetId),
        inArray(opportunity.brandId, brandIds),
        gte(opportunity.periodStart, from),
        lte(opportunity.periodStart, to)
      )
    )
    .orderBy(desc(opportunity.competitorCount), opportunity.type)
    .limit(MAX_OPPORTUNITIES);

  const promptIds = [...new Set(rows.map((r) => r.promptId))];
  const promptRows =
    promptIds.length > 0
      ? await db
          .select({ id: prompt.id, template: prompt.template })
          .from(prompt)
          .where(inArray(prompt.id, promptIds))
      : [];

  const promptMap = new Map(promptRows.map((r) => [r.id, r.template]));

  return rows.map((r) => ({
    brandId: r.brandId,
    brandName: brandMap.get(r.brandId) ?? '',
    query: promptMap.get(r.promptId) ?? '',
    type: r.type as 'missing' | 'weak',
    competitorCount: r.competitorCount,
  }));
}

// --- Platform Coverage ---

export async function getPlatformStatuses(workspaceId: string): Promise<PlatformStatus[]> {
  const result = await listAdapterConfigs(workspaceId, {
    page: 1,
    limit: 50,
    order: 'asc',
  });

  return result.items.map((adapter) => ({
    adapterId: adapter.id,
    platformId: adapter.platformId,
    displayName: adapter.displayName,
    enabled: adapter.enabled,
    lastHealthStatus: adapter.lastHealthStatus,
    lastHealthCheckedAt: adapter.lastHealthCheckedAt?.toISOString() ?? null,
  }));
}

// --- Alert Summary ---

export async function getAlertData(workspaceId: string): Promise<DashboardAlertSummary> {
  const [summary, recentEvents] = await Promise.all([
    getAlertSummary(workspaceId),
    db
      .select({
        id: alertEvent.id,
        ruleId: alertEvent.alertRuleId,
        severity: alertEvent.severity,
        triggeredAt: alertEvent.triggeredAt,
        condition: alertEvent.condition,
      })
      .from(alertEvent)
      .where(eq(alertEvent.workspaceId, workspaceId))
      .orderBy(desc(alertEvent.triggeredAt))
      .limit(MAX_RECENT_ALERTS),
  ]);

  return {
    active: summary.active,
    total: summary.total,
    bySeverity: summary.bySeverity,
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      ruleId: e.ruleId,
      severity: e.severity,
      triggeredAt: e.triggeredAt.toISOString(),
      message: `${e.severity} alert: ${e.condition}`,
    })),
  };
}
