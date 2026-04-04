import { randomBytes } from 'node:crypto';
import { eq, and, or, desc } from 'drizzle-orm';
import { arrayContains } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { webhookEndpoint } from './webhook-endpoint.schema';
import { webhookEvent } from './webhook-event.schema';
import { webhookDelivery } from './webhook-delivery.schema';
import { WEBHOOK_EVENT_TYPES, WEBHOOK_SAMPLE_PAYLOADS } from './webhook.events';
import type { WebhookEventType } from './webhook.events';
import { validateWebhookUrl } from './webhook.security';

const MAX_ENDPOINTS_PER_WORKSPACE = 10;

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

function validateEventTypes(events: string[]): string | null {
  for (const event of events) {
    if (event === '*') continue;
    if (!(WEBHOOK_EVENT_TYPES as readonly string[]).includes(event)) {
      return event;
    }
  }
  return null;
}

export async function createWebhookEndpoint(
  workspaceId: string,
  input: { url: string; events: string[]; description?: string }
) {
  const urlCheck = await validateWebhookUrl(input.url);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.reason ?? 'Invalid webhook URL');
  }

  const invalidEvent = validateEventTypes(input.events);
  if (invalidEvent) {
    throw new Error(`${invalidEvent} is not a valid event type`);
  }

  // Enforce max endpoints per workspace
  const existingCount = await countTotal(webhookEndpoint, [
    eq(webhookEndpoint.workspaceId, workspaceId),
  ]);
  if (existingCount >= MAX_ENDPOINTS_PER_WORKSPACE) {
    throw new Error(`Maximum number of webhook endpoints (${MAX_ENDPOINTS_PER_WORKSPACE}) reached`);
  }

  const secret = generateSecret();

  const [created] = await db
    .insert(webhookEndpoint)
    .values({
      workspaceId,
      url: input.url,
      events: input.events,
      description: input.description ?? null,
      secret,
    })
    .returning({
      id: webhookEndpoint.id,
      url: webhookEndpoint.url,
      events: webhookEndpoint.events,
      description: webhookEndpoint.description,
      enabled: webhookEndpoint.enabled,
      createdAt: webhookEndpoint.createdAt,
    });

  return { ...created, secret };
}

const ENDPOINT_SORT_COLUMNS = {
  createdAt: webhookEndpoint.createdAt,
  url: webhookEndpoint.url,
};

export const WEBHOOK_ENDPOINT_ALLOWED_SORTS = Object.keys(ENDPOINT_SORT_COLUMNS);

export async function listWebhookEndpoints(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions = [eq(webhookEndpoint.workspaceId, workspaceId)];
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, ENDPOINT_SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: webhookEndpoint.id,
        url: webhookEndpoint.url,
        events: webhookEndpoint.events,
        description: webhookEndpoint.description,
        enabled: webhookEndpoint.enabled,
        disabledAt: webhookEndpoint.disabledAt,
        disabledReason: webhookEndpoint.disabledReason,
        createdAt: webhookEndpoint.createdAt,
        updatedAt: webhookEndpoint.updatedAt,
      })
      .from(webhookEndpoint)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(webhookEndpoint.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(webhookEndpoint, conditions),
  ]);

  return { items, total };
}

export async function getWebhookEndpoint(id: string, workspaceId: string) {
  const [record] = await db
    .select({
      id: webhookEndpoint.id,
      url: webhookEndpoint.url,
      events: webhookEndpoint.events,
      description: webhookEndpoint.description,
      enabled: webhookEndpoint.enabled,
      disabledAt: webhookEndpoint.disabledAt,
      disabledReason: webhookEndpoint.disabledReason,
      failingSince: webhookEndpoint.failingSince,
      createdAt: webhookEndpoint.createdAt,
      updatedAt: webhookEndpoint.updatedAt,
    })
    .from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.workspaceId, workspaceId)))
    .limit(1);

  return record ?? null;
}

export async function updateWebhookEndpoint(
  id: string,
  workspaceId: string,
  input: {
    url?: string;
    events?: string[];
    description?: string | null;
    enabled?: boolean;
  }
) {
  if (input.url) {
    const urlCheck = await validateWebhookUrl(input.url);
    if (!urlCheck.valid) {
      throw new Error(urlCheck.reason ?? 'Invalid webhook URL');
    }
  }

  if (input.events) {
    const invalidEvent = validateEventTypes(input.events);
    if (invalidEvent) {
      throw new Error(`${invalidEvent} is not a valid event type`);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.url !== undefined) updateData.url = input.url;
  if (input.events !== undefined) updateData.events = input.events;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.enabled !== undefined) {
    updateData.enabled = input.enabled;
    // Clear failure state when re-enabling
    if (input.enabled) {
      updateData.disabledAt = null;
      updateData.disabledReason = null;
      updateData.failingSince = null;
    }
  }

  const [updated] = await db
    .update(webhookEndpoint)
    .set(updateData)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.workspaceId, workspaceId)))
    .returning({
      id: webhookEndpoint.id,
      url: webhookEndpoint.url,
      events: webhookEndpoint.events,
      description: webhookEndpoint.description,
      enabled: webhookEndpoint.enabled,
      disabledAt: webhookEndpoint.disabledAt,
      disabledReason: webhookEndpoint.disabledReason,
      failingSince: webhookEndpoint.failingSince,
      createdAt: webhookEndpoint.createdAt,
      updatedAt: webhookEndpoint.updatedAt,
    });

  return updated ?? null;
}

export async function deleteWebhookEndpoint(id: string, workspaceId: string) {
  const result = await db
    .delete(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.workspaceId, workspaceId)))
    .returning({ id: webhookEndpoint.id });

  return result.length > 0;
}

export async function rotateWebhookEndpointSecret(id: string, workspaceId: string) {
  const secret = generateSecret();

  const [updated] = await db
    .update(webhookEndpoint)
    .set({ secret })
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.workspaceId, workspaceId)))
    .returning({ id: webhookEndpoint.id });

  if (!updated) return null;

  return { secret };
}

export async function dispatchWebhookEvent(
  workspaceId: string,
  eventType: WebhookEventType,
  data: object,
  boss: PgBoss
) {
  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  return await db.transaction(async (tx) => {
    // Insert event
    const [event] = await tx
      .insert(webhookEvent)
      .values({
        workspaceId,
        eventType,
        payload,
      })
      .returning({ id: webhookEvent.id });

    // Find matching enabled endpoints
    const endpoints = await tx
      .select({
        id: webhookEndpoint.id,
        url: webhookEndpoint.url,
        secret: webhookEndpoint.secret,
      })
      .from(webhookEndpoint)
      .where(
        and(
          eq(webhookEndpoint.workspaceId, workspaceId),
          eq(webhookEndpoint.enabled, true),
          or(
            arrayContains(webhookEndpoint.events, [eventType]),
            arrayContains(webhookEndpoint.events, ['*'])
          )
        )
      );

    const deliveryIds: string[] = [];

    for (const endpoint of endpoints) {
      // Insert delivery row
      const [delivery] = await tx
        .insert(webhookDelivery)
        .values({
          webhookEndpointId: endpoint.id,
          webhookEventId: event.id,
        })
        .returning({ id: webhookDelivery.id });

      deliveryIds.push(delivery.id);

      // Enqueue pg-boss job
      await boss.send(
        'webhook-delivery',
        {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
          eventId: event.id,
          url: endpoint.url,
          secret: endpoint.secret,
          payload,
        },
        {
          retryLimit: 7,
          retryDelay: 5,
          retryBackoff: true,
          expireInSeconds: 30,
        }
      );
    }

    return { eventId: event.id, deliveryIds };
  });
}

export async function sendTestEvent(endpointId: string, workspaceId: string, boss: PgBoss) {
  const endpoint = await getWebhookEndpoint(endpointId, workspaceId);
  if (!endpoint) {
    throw new Error('Webhook endpoint not found');
  }

  if (!endpoint.enabled) {
    throw new Error('This webhook endpoint is disabled');
  }

  // Pick event type: use webhook.test if subscribed to '*', otherwise first subscribed type
  let eventType: WebhookEventType = 'webhook.test';
  if (!endpoint.events.includes('*')) {
    const firstValid = endpoint.events.find((e) =>
      (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e)
    ) as WebhookEventType | undefined;
    if (firstValid) eventType = firstValid;
  }

  const sampleData = WEBHOOK_SAMPLE_PAYLOADS[eventType];
  return await dispatchWebhookEvent(workspaceId, eventType, sampleData, boss);
}

const DELIVERY_SORT_COLUMNS = {
  createdAt: webhookDelivery.createdAt,
  status: webhookDelivery.status,
};

export const WEBHOOK_DELIVERY_ALLOWED_SORTS = Object.keys(DELIVERY_SORT_COLUMNS);

export async function listDeliveries(
  endpointId: string,
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  // Verify endpoint belongs to workspace
  const endpoint = await getWebhookEndpoint(endpointId, workspaceId);
  if (!endpoint) {
    throw new Error('Webhook endpoint not found');
  }

  const conditions = [eq(webhookDelivery.webhookEndpointId, endpointId)];
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, DELIVERY_SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: webhookDelivery.id,
        eventType: webhookEvent.eventType,
        attemptNumber: webhookDelivery.attemptNumber,
        status: webhookDelivery.status,
        httpStatus: webhookDelivery.httpStatus,
        responseLatencyMs: webhookDelivery.responseLatencyMs,
        errorMessage: webhookDelivery.errorMessage,
        createdAt: webhookDelivery.createdAt,
        completedAt: webhookDelivery.completedAt,
      })
      .from(webhookDelivery)
      .innerJoin(webhookEvent, eq(webhookDelivery.webhookEventId, webhookEvent.id))
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(webhookDelivery.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(webhookDelivery, conditions),
  ]);

  return { items, total };
}
