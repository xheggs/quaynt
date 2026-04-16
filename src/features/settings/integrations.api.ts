import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  PlatformInfo,
  AdapterConfig,
  AdapterCreate,
  AdapterUpdate,
  AdapterHealthResult,
  ApiKeyInfo,
  ApiKeyCreate,
  ApiKeyGenerated,
  WebhookEndpoint,
  WebhookCreate,
  WebhookUpdate,
  WebhookDelivery,
  WebhookSecretRotation,
} from './integrations.types';

// ─── Adapters ────────────────────────────────────────────────────────────────

export function fetchPlatforms(): Promise<PlatformInfo[]> {
  return apiFetch<PlatformInfo[]>('/adapters/platforms');
}

export function fetchAdapters(params?: QueryFilters): Promise<PaginatedResponse<AdapterConfig>> {
  return apiFetchPaginated<AdapterConfig>('/adapters', { ...params });
}

export function fetchAdapter(id: string): Promise<AdapterConfig> {
  return apiFetch<AdapterConfig>(`/adapters/${id}`);
}

export function createAdapter(input: AdapterCreate): Promise<AdapterConfig> {
  return apiFetch<AdapterConfig>('/adapters', {
    method: 'POST',
    body: input,
  });
}

export function updateAdapter(id: string, input: AdapterUpdate): Promise<AdapterConfig> {
  return apiFetch<AdapterConfig>(`/adapters/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteAdapter(id: string): Promise<void> {
  return apiFetch<void>(`/adapters/${id}`, {
    method: 'DELETE',
  });
}

export function checkAdapterHealth(id: string): Promise<AdapterHealthResult> {
  return apiFetch<AdapterHealthResult>(`/adapters/${id}/health`);
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export function fetchApiKeys(params?: QueryFilters): Promise<PaginatedResponse<ApiKeyInfo>> {
  return apiFetchPaginated<ApiKeyInfo>('/api-keys', { ...params });
}

export function generateApiKey(input: ApiKeyCreate): Promise<ApiKeyGenerated> {
  return apiFetch<ApiKeyGenerated>('/api-keys', {
    method: 'POST',
    body: input,
  });
}

export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/api-keys/${id}`, {
    method: 'DELETE',
  });
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export function fetchWebhooks(params?: QueryFilters): Promise<PaginatedResponse<WebhookEndpoint>> {
  return apiFetchPaginated<WebhookEndpoint>('/webhooks', { ...params });
}

export function fetchWebhook(id: string): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/webhooks/${id}`);
}

export function createWebhook(input: WebhookCreate): Promise<WebhookEndpoint & { secret: string }> {
  return apiFetch<WebhookEndpoint & { secret: string }>('/webhooks', {
    method: 'POST',
    body: input,
  });
}

export function updateWebhook(id: string, input: WebhookUpdate): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/webhooks/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, {
    method: 'DELETE',
  });
}

export function testWebhook(id: string): Promise<{ eventId: string }> {
  return apiFetch<{ eventId: string }>(`/webhooks/${id}/test`, {
    method: 'POST',
  });
}

export function rotateWebhookSecret(id: string): Promise<WebhookSecretRotation> {
  return apiFetch<WebhookSecretRotation>(`/webhooks/${id}/secret/rotate`, {
    method: 'POST',
  });
}

export function fetchWebhookDeliveries(
  webhookId: string,
  params?: QueryFilters
): Promise<PaginatedResponse<WebhookDelivery>> {
  return apiFetchPaginated<WebhookDelivery>(`/webhooks/${webhookId}/deliveries`, { ...params });
}
