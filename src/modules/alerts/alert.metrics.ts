import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recommendationShare } from '@/modules/visibility/recommendation-share.schema';
import { sentimentAggregate } from '@/modules/visibility/sentiment-aggregate.schema';
import { positionAggregate } from '@/modules/visibility/position-aggregate.schema';
import { crawlerDailyAggregate } from '@/modules/crawler/crawler-aggregate.schema';
import { trafficDailyAggregate } from '@/modules/traffic/traffic-aggregate.schema';
import { geoScoreSnapshot } from '@/modules/visibility/geo-score-snapshot.schema';
import { seoScoreSnapshot } from '@/modules/visibility/seo-score-snapshot.schema';
import type { AlertMetric, AlertScope } from './alert.types';

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
  // Traffic attribution metrics — also workspace-scoped (optionally per-platform).
  if (metric === 'ai_visit_count') {
    return resolveFromAiVisitCount(workspaceId, scope.platform, date);
  }
  if (metric === 'ai_visit_platform_drop') {
    return resolveFromAiVisitPlatformDrop(workspaceId, scope.platform, date);
  }
  // Brand-scoped GEO score — reads geo_score_snapshot for the brand in scope.
  if (metric === 'geo_score') {
    return resolveFromGeoScore(workspaceId, scope.brandId);
  }
  // Brand-scoped SEO score — reads seo_score_snapshot for the brand in scope.
  if (metric === 'seo_score') {
    return resolveFromSeoScore(workspaceId, scope.brandId);
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
    default:
      return { currentValue: null, previousValue: null };
  }
}

async function resolveFromSeoScore(
  workspaceId: string,
  brandId: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  const rows = await db
    .select({
      composite: seoScoreSnapshot.composite,
      periodStart: seoScoreSnapshot.periodStart,
    })
    .from(seoScoreSnapshot)
    .where(
      and(
        eq(seoScoreSnapshot.workspaceId, workspaceId),
        eq(seoScoreSnapshot.brandId, brandId),
        eq(seoScoreSnapshot.granularity, 'monthly'),
        eq(seoScoreSnapshot.platformId, '_all'),
        eq(seoScoreSnapshot.locale, '_all')
      )
    )
    .orderBy(desc(seoScoreSnapshot.periodStart))
    .limit(2);

  if (rows.length === 0) return { currentValue: null, previousValue: null };

  const currentValue = rows[0].composite === null ? null : Number(rows[0].composite);
  const previousValue =
    rows.length > 1 && rows[1].composite !== null ? Number(rows[1].composite) : null;

  return { currentValue, previousValue };
}

async function resolveFromGeoScore(
  workspaceId: string,
  brandId: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  // Brand-scoped: read the latest and previous monthly snapshots (_all/_all platform/locale)
  const rows = await db
    .select({
      composite: geoScoreSnapshot.composite,
      periodStart: geoScoreSnapshot.periodStart,
    })
    .from(geoScoreSnapshot)
    .where(
      and(
        eq(geoScoreSnapshot.workspaceId, workspaceId),
        eq(geoScoreSnapshot.brandId, brandId),
        eq(geoScoreSnapshot.granularity, 'monthly'),
        eq(geoScoreSnapshot.platformId, '_all'),
        eq(geoScoreSnapshot.locale, '_all')
      )
    )
    .orderBy(desc(geoScoreSnapshot.periodStart))
    .limit(2);

  if (rows.length === 0) return { currentValue: null, previousValue: null };

  const currentValue = rows[0].composite === null ? null : Number(rows[0].composite);
  const previousValue =
    rows.length > 1 && rows[1].composite !== null ? Number(rows[1].composite) : null;

  return { currentValue, previousValue };
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

async function resolveFromAiVisitCount(
  workspaceId: string,
  platform: string | undefined,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  // '_all_' sums across sources; an explicit platform uses that slug; otherwise use the
  // workspace total (platform='_all_').
  const targetPlatform = platform ?? '_all_';

  const [current] = await db
    .select({ visitCount: trafficDailyAggregate.visitCount })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.source, '_all_'),
        eq(trafficDailyAggregate.platform, targetPlatform),
        eq(trafficDailyAggregate.periodStart, date)
      )
    )
    .limit(1);

  const [previous] = await db
    .select({ visitCount: trafficDailyAggregate.visitCount })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.source, '_all_'),
        eq(trafficDailyAggregate.platform, targetPlatform),
        lt(trafficDailyAggregate.periodStart, date)
      )
    )
    .orderBy(desc(trafficDailyAggregate.periodStart))
    .limit(1);

  return {
    currentValue: current?.visitCount ?? null,
    previousValue: previous?.visitCount ?? null,
  };
}

async function resolveFromAiVisitPlatformDrop(
  workspaceId: string,
  platform: string | undefined,
  date: string
): Promise<{ currentValue: number | null; previousValue: number | null }> {
  // Returns consecutive days with zero visits for the specified platform.
  // currentValue = days since the platform last delivered a visit. 0 means it is active today.
  const targetPlatform = platform ?? '_all_';

  const [current] = await db
    .select({ visitCount: trafficDailyAggregate.visitCount })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.source, '_all_'),
        eq(trafficDailyAggregate.platform, targetPlatform),
        eq(trafficDailyAggregate.periodStart, date)
      )
    )
    .limit(1);

  const currentVisits = current?.visitCount ?? 0;

  const [lastActive] = await db
    .select({ periodStart: trafficDailyAggregate.periodStart })
    .from(trafficDailyAggregate)
    .where(
      and(
        eq(trafficDailyAggregate.workspaceId, workspaceId),
        eq(trafficDailyAggregate.source, '_all_'),
        eq(trafficDailyAggregate.platform, targetPlatform),
        sql`${trafficDailyAggregate.visitCount} > 0`
      )
    )
    .orderBy(desc(trafficDailyAggregate.periodStart))
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
