import type { PgBoss } from 'pg-boss';
import { env } from '@/lib/config/env';
import { registerWebhookHandlers } from '@/modules/webhooks/webhook.handler';
import { registerModelRunHandlers } from '@/modules/model-runs/model-run.handler';
import { registerCitationHandlers } from '@/modules/citations/citation.handler';
import { registerVisibilityHandlers } from '@/modules/visibility/recommendation-share.handler';
import { registerSentimentAggregateHandlers } from '@/modules/visibility/sentiment-aggregate.handler';
import { registerCitationSourceHandlers } from '@/modules/visibility/citation-source-aggregate.handler';
import { registerOpportunityHandlers } from '@/modules/visibility/opportunity.handler';
import { registerPositionAggregateHandlers } from '@/modules/visibility/position-aggregate.handler';
import { registerGeoScoreHandlers } from '@/modules/visibility/geo-score.handler';
import { registerSeoScoreHandlers } from '@/modules/visibility/seo-score.handler';
import { registerAlertHandlers } from '@/modules/alerts/alert.handler';
import { registerNotificationHandlers } from '@/modules/notifications/notification.handler';
import { registerPdfHandlers } from '@/modules/pdf/pdf.handler';
import { registerScheduledReportHandlers } from '@/modules/scheduled-reports/scheduled-report.handler';
import { registerCrawlerParseHandler } from '@/modules/crawler/crawler-parse.handler';
import { registerCrawlerAggregateHandler } from '@/modules/crawler/crawler-aggregate.handler';
import { registerTrafficHandlers } from '@/modules/traffic/traffic-aggregate.handler';
import { registerGscSyncHandler } from '@/modules/integrations/gsc-correlation/gsc-sync.handler';
import { registerQueryFanoutSimulatorHandlers } from '@/modules/query-fanout/query-fanout-simulator.handler';
import { registerOnboardingSuggestHandler } from '@/modules/onboarding/onboarding-suggest.handler';

export async function registerHandlers(boss: PgBoss): Promise<void> {
  await registerWebhookHandlers(boss);
  await registerModelRunHandlers(boss);
  await registerCitationHandlers(boss);
  await registerVisibilityHandlers(boss);
  await registerSentimentAggregateHandlers(boss);
  await registerCitationSourceHandlers(boss);
  await registerOpportunityHandlers(boss);
  await registerPositionAggregateHandlers(boss);
  await registerGeoScoreHandlers(boss);
  await registerSeoScoreHandlers(boss);
  await registerAlertHandlers(boss);
  await registerNotificationHandlers(boss);
  await registerPdfHandlers(boss);
  await registerScheduledReportHandlers(boss);
  await registerCrawlerParseHandler(boss);
  await registerCrawlerAggregateHandler(boss);
  await registerTrafficHandlers(boss);
  await registerGscSyncHandler(boss);
  await registerQueryFanoutSimulatorHandlers(boss);
  await registerOnboardingSuggestHandler(boss);

  // Commercial-only handlers
  if (env.QUAYNT_EDITION !== 'community') {
    const { registerTrendSnapshotHandlers } =
      await import('@/modules/visibility/trend-snapshot.handler');
    await registerTrendSnapshotHandlers(boss);

    const { registerLogoCleanupHandler } =
      await import('@/modules/report-templates/template-logo-cleanup.handler');
    await registerLogoCleanupHandler(boss);
  }
}
