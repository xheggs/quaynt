import type { PgBoss, JobWithMetadata } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { webhookDelivery } from './webhook-delivery.schema';
import { webhookEndpoint } from './webhook-endpoint.schema';
import { deliverWebhook } from './webhook.delivery';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const RETRY_LIMIT = 7;

interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  eventId: string;
  url: string;
  secret: string;
  payload: { event: string; timestamp: string; data: object };
}

async function processJob(job: JobWithMetadata<WebhookDeliveryJobData>): Promise<void> {
  const { deliveryId, endpointId, eventId, url, secret, payload } = job.data;
  const attemptNumber = (job.retryCount ?? 0) + 1;

  const log = logger.child({
    deliveryId,
    endpointId,
    eventId,
    eventType: payload.event,
    attemptNumber,
  });

  // Update attempt number
  await db.update(webhookDelivery).set({ attemptNumber }).where(eq(webhookDelivery.id, deliveryId));

  const result = await deliverWebhook({
    deliveryId,
    url,
    secret,
    payload,
  });

  if (result.success) {
    // Success: update delivery, clear endpoint failure state
    await db
      .update(webhookDelivery)
      .set({
        status: 'success',
        httpStatus: result.httpStatus,
        responseBody: result.responseBody,
        responseLatencyMs: result.latencyMs,
        completedAt: new Date(),
      })
      .where(eq(webhookDelivery.id, deliveryId));

    await db
      .update(webhookEndpoint)
      .set({ failingSince: null })
      .where(eq(webhookEndpoint.id, endpointId));

    log.info(
      { status: 'success', httpStatus: result.httpStatus, latencyMs: result.latencyMs },
      'Webhook delivered successfully'
    );
    return;
  }

  // Failure: update delivery with attempt details
  await db
    .update(webhookDelivery)
    .set({
      status: 'failed',
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      responseLatencyMs: result.latencyMs,
      errorMessage: result.error,
    })
    .where(eq(webhookDelivery.id, deliveryId));

  // Set failingSince if not already set
  const [endpoint] = await db
    .select({
      failingSince: webhookEndpoint.failingSince,
      enabled: webhookEndpoint.enabled,
    })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.id, endpointId))
    .limit(1);

  if (endpoint && !endpoint.failingSince) {
    await db
      .update(webhookEndpoint)
      .set({ failingSince: new Date() })
      .where(eq(webhookEndpoint.id, endpointId));
  }

  // Permanent failure (e.g., SSRF blocked) — don't retry
  if (result.permanent) {
    await db
      .update(webhookDelivery)
      .set({ completedAt: new Date() })
      .where(eq(webhookDelivery.id, deliveryId));

    log.error({ error: result.error }, 'Webhook delivery permanently failed');
    return;
  }

  // Check for auto-disable: if failing for more than 5 days
  if (
    endpoint?.failingSince &&
    Date.now() - endpoint.failingSince.getTime() > FIVE_DAYS_MS &&
    job.retryCount >= RETRY_LIMIT - 1
  ) {
    await db
      .update(webhookEndpoint)
      .set({
        enabled: false,
        disabledAt: new Date(),
        disabledReason: 'consecutive_failures',
      })
      .where(eq(webhookEndpoint.id, endpointId));

    await db
      .update(webhookDelivery)
      .set({ completedAt: new Date() })
      .where(eq(webhookDelivery.id, deliveryId));

    log.error(
      { failingSince: endpoint.failingSince },
      'Webhook endpoint auto-disabled after consecutive failures'
    );
    return;
  }

  log.warn(
    { httpStatus: result.httpStatus, error: result.error, latencyMs: result.latencyMs },
    'Webhook delivery failed, retrying'
  );

  // Throw to trigger pg-boss retry
  throw new Error(result.error ?? 'Webhook delivery failed');
}

export async function registerWebhookHandlers(boss: PgBoss): Promise<void> {
  await boss.work<WebhookDeliveryJobData>(
    'webhook-delivery',
    { includeMetadata: true, localConcurrency: 5 },
    async (jobs) => {
      for (const job of jobs) {
        await processJob(job);
      }
    }
  );
}
