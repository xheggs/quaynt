import { vi } from 'vitest';

// --- Table-aware DB mock ---

export const tableResults = new Map<string, unknown[][]>();
export const tableCallIndex = new Map<string, number>();

export function pushTableResult(table: string, rows: unknown[]) {
  const existing = tableResults.get(table) ?? [];
  existing.push(rows);
  tableResults.set(table, existing);
}

export function mockTable(name: string) {
  return new Proxy(
    { __tableName: name },
    {
      get: (_t, prop) => {
        if (prop === '__tableName') return name;
        return `${name}.${String(prop)}`;
      },
    }
  );
}

export function resetTableState() {
  tableResults.clear();
  tableCallIndex.clear();
}

export function createMockDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      let tableName = 'unknown';
      const proxy: Record<string, unknown> = {};

      const returnSelf = () => proxy;
      proxy.from = vi.fn().mockImplementation((table: unknown) => {
        if (table && typeof table === 'object' && '__tableName' in table) {
          tableName = (table as { __tableName: string }).__tableName;
        }
        return proxy;
      });
      proxy.where = vi.fn().mockImplementation(returnSelf);
      proxy.orderBy = vi.fn().mockImplementation(returnSelf);
      proxy.limit = vi.fn().mockImplementation(returnSelf);
      proxy.groupBy = vi.fn().mockImplementation(returnSelf);
      proxy.innerJoin = vi.fn().mockImplementation(returnSelf);
      proxy.leftJoin = vi.fn().mockImplementation(returnSelf);

      proxy.then = (resolve: (val: unknown) => void) => {
        const results = tableResults.get(tableName) ?? [];
        const idx = tableCallIndex.get(tableName) ?? 0;
        tableCallIndex.set(tableName, idx + 1);
        resolve(results[idx] ?? []);
      };

      return proxy;
    }),
  };
}

// --- Fixture factories ---

export const mockListBrands = vi.fn();
export const mockListAdapterConfigs = vi.fn();
export const mockGetAlertSummary = vi.fn();
export const mockEnv: Record<string, unknown> = { QUAYNT_EDITION: 'community' };

export function setupDefaultBrands() {
  mockListBrands.mockResolvedValue({
    items: [
      { id: 'brand_1', name: 'Brand One' },
      { id: 'brand_2', name: 'Brand Two' },
    ],
    total: 2,
  });
}

export function setupEmptyBrands() {
  mockListBrands.mockResolvedValue({ items: [], total: 0 });
}

export function setupDefaultAdapters() {
  mockListAdapterConfigs.mockResolvedValue({
    items: [
      {
        id: 'adapter_1',
        platformId: 'chatgpt',
        displayName: 'ChatGPT',
        enabled: true,
        lastHealthStatus: 'healthy',
        lastHealthCheckedAt: new Date('2026-04-01T12:00:00Z'),
      },
      {
        id: 'adapter_2',
        platformId: 'perplexity',
        displayName: 'Perplexity',
        enabled: true,
        lastHealthStatus: 'healthy',
        lastHealthCheckedAt: new Date('2026-04-01T12:00:00Z'),
      },
    ],
    total: 2,
  });
}

export function setupDefaultAlerts() {
  mockGetAlertSummary.mockResolvedValue({
    active: 3,
    total: 10,
    acknowledged: 5,
    snoozed: 2,
    bySeverity: { info: 2, warning: 5, critical: 3 },
    topRules: [],
    period: { from: '2026-03-09', to: '2026-04-08' },
  });
}

export function setupPromptSetAutoResolve() {
  pushTableResult('model_run', [{ id: 'ps_1', name: 'Main Market' }]);
}

export function setupKPIAndMoversQueries() {
  pushTableResult('recommendation_share', [
    { brandId: 'brand_1', sharePercentage: '40.00', citationCount: 100 },
    { brandId: 'brand_2', sharePercentage: '60.00', citationCount: 50 },
  ]);
  pushTableResult('recommendation_share', [
    { brandId: 'brand_1', totalWeightedShare: '4000', totalCitations: 100 },
    { brandId: 'brand_2', totalWeightedShare: '3000', totalCitations: 50 },
  ]);
  pushTableResult('recommendation_share', [
    { brandId: 'brand_1', sharePercentage: '35.00', citationCount: 90 },
    { brandId: 'brand_2', sharePercentage: '55.00', citationCount: 45 },
  ]);
  pushTableResult('recommendation_share', [
    { brandId: 'brand_1', totalWeightedShare: '3150', totalCitations: 90 },
    { brandId: 'brand_2', totalWeightedShare: '2475', totalCitations: 45 },
  ]);
  pushTableResult('recommendation_share', [
    { period: '2026-03-15', totalWeightedShare: '6000', totalCitations: 150 },
    { period: '2026-03-16', totalWeightedShare: '6200', totalCitations: 155 },
  ]);
  pushTableResult('recommendation_share', [
    { period: '2026-03-15', totalCitations: 150 },
    { period: '2026-03-16', totalCitations: 155 },
  ]);

  pushTableResult('sentiment_aggregate', [
    { brandId: 'brand_1', netSentimentScore: '30.00', totalCount: 100 },
    { brandId: 'brand_2', netSentimentScore: '20.00', totalCount: 50 },
  ]);
  pushTableResult('sentiment_aggregate', [
    { brandId: 'brand_1', netSentimentScore: '25.00', totalCount: 90 },
    { brandId: 'brand_2', netSentimentScore: '18.00', totalCount: 45 },
  ]);
  pushTableResult('sentiment_aggregate', [
    { period: '2026-03-15', totalWeightedScore: '3600', totalCount: 150 },
    { period: '2026-03-16', totalWeightedScore: '3700', totalCount: 155 },
  ]);
}

export function setupOpportunitiesQueries() {
  pushTableResult('opportunity', [
    { brandId: 'brand_1', promptId: 'prompt_1', type: 'missing', competitorCount: 5 },
    { brandId: 'brand_2', promptId: 'prompt_2', type: 'weak', competitorCount: 3 },
  ]);
  pushTableResult('prompt', [
    { id: 'prompt_1', template: 'Best CRM software?' },
    { id: 'prompt_2', template: 'Top project management tools?' },
  ]);
}

export function setupAlertEventsQuery() {
  pushTableResult('alert_event', [
    {
      id: 'evt_1',
      ruleId: 'rule_1',
      severity: 'critical',
      triggeredAt: new Date('2026-04-07T10:00:00Z'),
      condition: 'above_threshold',
    },
  ]);
}

export function setupDataAsOfQuery() {
  pushTableResult('model_run', [{ completedAt: new Date('2026-04-07T08:00:00Z') }]);
}

export function setupFullDashboard() {
  setupPromptSetAutoResolve();
  setupKPIAndMoversQueries();
  setupOpportunitiesQueries();
  setupAlertEventsQuery();
  setupDataAsOfQuery();
}
