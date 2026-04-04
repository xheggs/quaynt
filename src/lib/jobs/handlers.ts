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
import { registerAlertHandlers } from '@/modules/alerts/alert.handler';
import { registerNotificationHandlers } from '@/modules/notifications/notification.handler';

export async function registerHandlers(boss: PgBoss): Promise<void> {
  await registerWebhookHandlers(boss);
  await registerModelRunHandlers(boss);
  await registerCitationHandlers(boss);
  await registerVisibilityHandlers(boss);
  await registerSentimentAggregateHandlers(boss);
  await registerCitationSourceHandlers(boss);
  await registerOpportunityHandlers(boss);
  await registerPositionAggregateHandlers(boss);
  await registerAlertHandlers(boss);
  await registerNotificationHandlers(boss);

  // Commercial-only handlers
  if (env.QUAYNT_EDITION !== 'community') {
    const { registerTrendSnapshotHandlers } =
      await import('@/modules/visibility/trend-snapshot.handler');
    await registerTrendSnapshotHandlers(boss);
  }
}
