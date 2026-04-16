/**
 * Hierarchical query key factory for TanStack Query.
 *
 * Usage:
 *   queryKeys.brands.all        → ['brands']
 *   queryKeys.brands.lists()    → ['brands', 'list']
 *   queryKeys.brands.list({…})  → ['brands', 'list', { page: 1, limit: 25 }]
 *   queryKeys.brands.details()  → ['brands', 'detail']
 *   queryKeys.brands.detail(id) → ['brands', 'detail', 'abc-123']
 */

function createQueryKeys<T extends string>(domain: T) {
  return {
    all: [domain] as const,
    lists: () => [domain, 'list'] as const,
    list: (filters: Record<string, unknown>) => [domain, 'list', filters] as const,
    details: () => [domain, 'detail'] as const,
    detail: (id: string) => [domain, 'detail', id] as const,
  };
}

export const queryKeys = {
  brands: createQueryKeys('brands'),
  promptSets: createQueryKeys('promptSets'),
  modelRuns: createQueryKeys('modelRuns'),
  citations: createQueryKeys('citations'),
  visibility: createQueryKeys('visibility'),
  benchmarks: createQueryKeys('benchmarks'),
  opportunities: createQueryKeys('opportunities'),
  alerts: createQueryKeys('alerts'),
  alertEvents: createQueryKeys('alertEvents'),
  notificationPreferences: createQueryKeys('notificationPreferences'),
  reports: createQueryKeys('reports'),
  reportJobs: createQueryKeys('reportJobs'),
  reportSchedules: createQueryKeys('reportSchedules'),
  reportDeliveries: createQueryKeys('reportDeliveries'),
  dashboard: createQueryKeys('dashboard'),
  adapters: createQueryKeys('adapters'),
  platforms: createQueryKeys('platforms'),
  apiKeys: createQueryKeys('apiKeys'),
  webhooks: createQueryKeys('webhooks'),
  webhookDeliveries: createQueryKeys('webhookDeliveries'),
  workspace: createQueryKeys('workspace'),
  reportTemplates: createQueryKeys('reportTemplates'),
  userPreferences: createQueryKeys('userPreferences'),
  members: createQueryKeys('members'),
} as const;
