'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import {
  fetchPlatforms,
  fetchAdapters,
  fetchAdapter,
  fetchApiKeys,
  fetchWebhooks,
  fetchWebhookDeliveries,
} from './integrations.api';
import type {
  PlatformInfo,
  AdapterConfig,
  ApiKeyInfo,
  WebhookEndpoint,
  WebhookDelivery,
} from './integrations.types';

export function usePlatformsQuery() {
  return useQuery<PlatformInfo[]>({
    queryKey: queryKeys.platforms.all,
    queryFn: () => fetchPlatforms(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAdaptersQuery() {
  return usePaginatedQuery<AdapterConfig>({
    queryKey: (params) => queryKeys.adapters.list({ ...params }),
    queryFn: (params) => fetchAdapters(params),
    defaultSort: 'createdAt',
  });
}

export function useAdapterQuery(id: string | null) {
  return useQuery<AdapterConfig>({
    queryKey: queryKeys.adapters.detail(id ?? ''),
    queryFn: () => fetchAdapter(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useApiKeysQuery() {
  return usePaginatedQuery<ApiKeyInfo>({
    queryKey: (params) => queryKeys.apiKeys.list({ ...params }),
    queryFn: (params) => fetchApiKeys(params),
    defaultSort: 'createdAt',
  });
}

export function useWebhooksQuery() {
  return usePaginatedQuery<WebhookEndpoint>({
    queryKey: (params) => queryKeys.webhooks.list({ ...params }),
    queryFn: (params) => fetchWebhooks(params),
    defaultSort: 'createdAt',
  });
}

export function useWebhookDeliveriesQuery(webhookId: string | null) {
  return usePaginatedQuery<WebhookDelivery>({
    queryKey: (params) =>
      queryKeys.webhookDeliveries.list({ webhookId: webhookId ?? '__none__', ...params }),
    queryFn: (params) => {
      if (!webhookId) return Promise.resolve({ data: [], meta: { page: 1, limit: 25, total: 0 } });
      return fetchWebhookDeliveries(webhookId, params);
    },
    defaultSort: 'createdAt',
  });
}
