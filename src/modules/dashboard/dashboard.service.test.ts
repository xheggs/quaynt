// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockListBrands,
  mockListAdapterConfigs,
  mockGetAlertSummary,
  mockEnv,
  mockTable,
  createMockDb,
  resetTableState,
  pushTableResult,
  setupDefaultBrands,
  setupEmptyBrands,
  setupDefaultAdapters,
  setupDefaultAlerts,
  setupPromptSetAutoResolve,
  setupKPIAndMoversQueries,
  setupOpportunitiesQueries,
  setupAlertEventsQuery,
  setupDataAsOfQuery,
  setupFullDashboard,
} from './dashboard.test-helpers';

// --- Mocks ---

vi.mock('@/modules/brands/brand.service', () => ({
  listBrands: (...args: unknown[]) => mockListBrands(...args),
}));
vi.mock('@/modules/adapters/adapter.service', () => ({
  listAdapterConfigs: (...args: unknown[]) => mockListAdapterConfigs(...args),
}));
vi.mock('@/modules/alerts/alert.service', () => ({
  getAlertSummary: (...args: unknown[]) => mockGetAlertSummary(...args),
}));

vi.mock('@/lib/config/env', () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_t, p) => mockEnv[p as string],
  }),
}));

vi.mock('@/lib/db', () => ({ db: createMockDb() }));

vi.mock('@/modules/visibility/recommendation-share.schema', () => ({
  recommendationShare: mockTable('recommendation_share'),
}));
vi.mock('@/modules/visibility/sentiment-aggregate.schema', () => ({
  sentimentAggregate: mockTable('sentiment_aggregate'),
}));
vi.mock('@/modules/visibility/opportunity.schema', () => ({
  opportunity: mockTable('opportunity'),
}));
vi.mock('@/modules/visibility/trend-snapshot.schema', () => ({
  trendSnapshot: mockTable('trend_snapshot'),
}));
vi.mock('@/modules/alerts/alert.schema', () => ({
  alertEvent: mockTable('alert_event'),
  alertRule: mockTable('alert_rule'),
}));
vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: mockTable('model_run'),
  modelRunStatus: vi.fn(),
}));
vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: mockTable('prompt_set'),
}));
vi.mock('@/modules/prompt-sets/prompt.schema', () => ({
  prompt: mockTable('prompt'),
}));
vi.mock('@/modules/brands/brand.schema', () => ({
  brand: mockTable('brand'),
}));

// --- Tests ---

describe('dashboard.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTableState();
    mockEnv.QUAYNT_EDITION = 'community';
  });

  async function loadService() {
    return (await import('./dashboard.service')).getDashboardData;
  }

  it('returns full dashboard with all sections populated', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.kpis).not.toBeNull();
    expect(result.kpis!.recommendationShare.current).toBeDefined();
    expect(result.kpis!.totalCitations.current).toBeDefined();
    expect(result.kpis!.averageSentiment.current).toBeDefined();
    expect(result.movers).not.toBeNull();
    expect(result.movers!.length).toBeGreaterThan(0);
    expect(result.opportunities).not.toBeNull();
    expect(result.opportunities!.length).toBeGreaterThan(0);
    expect(result.platforms).not.toBeNull();
    expect(result.platforms!).toHaveLength(2);
    expect(result.alerts).not.toBeNull();
    expect(result.alerts!.active).toBe(3);
    expect(result.promptSet.id).toBe('ps_1');
    expect(result.period.from).toBe('2026-03-01');
    expect(result.period.to).toBe('2026-03-31');
    expect(result.dataAsOf).toContain('2026-04-07');
  });

  it('returns empty/zero KPIs for workspace with no brands', async () => {
    setupEmptyBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupPromptSetAutoResolve();
    setupAlertEventsQuery();
    setupDataAsOfQuery();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.kpis).not.toBeNull();
    expect(result.kpis!.recommendationShare.current).toBe('0');
    expect(result.kpis!.totalCitations.current).toBe('0');
    expect(result.kpis!.averageSentiment.current).toBe('0');
    expect(result.movers).toEqual([]);
    expect(result.opportunities).toEqual([]);
  });

  it('partial failure — one section rejects, others succeed', async () => {
    setupDefaultBrands();
    mockListAdapterConfigs.mockRejectedValue(new Error('DB error'));
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.kpis).not.toBeNull();
    expect(result.platforms).toBeNull();
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('platforms'))).toBe(true);
  });

  it('auto-resolves default prompt set from most recent model run', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test');

    expect(result.promptSet.id).toBe('ps_1');
    expect(result.promptSet.name).toBe('Main Market');
  });

  it('uses default 30-day range when no dates provided', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test');

    const diffMs = new Date(result.period.to).getTime() - new Date(result.period.from).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    expect(diffDays).toBe(29);
  });

  it('movers returns all brands when fewer than 5', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.movers).not.toBeNull();
    expect(result.movers!.length).toBeLessThanOrEqual(2);
    for (const mover of result.movers!) {
      expect(mover).toHaveProperty('brandId');
      expect(mover).toHaveProperty('brandName');
      expect(mover).toHaveProperty('delta');
      expect(mover).toHaveProperty('direction');
      expect(mover.metric).toBe('recommendation_share');
    }
  });

  it('throws PROMPT_SET_NOT_FOUND for explicit invalid promptSetId', async () => {
    setupDefaultBrands();
    pushTableResult('prompt_set', []);

    const getDashboardData = await loadService();

    await expect(getDashboardData('ws_test', { promptSetId: 'invalid_ps' })).rejects.toThrow(
      'PROMPT_SET_NOT_FOUND'
    );
  });

  it('community edition omits trends field', async () => {
    mockEnv.QUAYNT_EDITION = 'community';
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.kpis).not.toBeNull();
    expect(result.kpis!.trends).toBeUndefined();
  });

  it('commercial edition includes trends when data exists', async () => {
    mockEnv.QUAYNT_EDITION = 'commercial';
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupPromptSetAutoResolve();

    pushTableResult('trend_snapshot', [
      {
        metric: 'recommendation_share',
        isSignificant: true,
        pValue: '0.01',
        delta: '5.00',
        isAnomaly: false,
        value: '45.00',
        ewmaUpper: null,
        ewmaLower: null,
      },
      {
        metric: 'sentiment',
        isSignificant: false,
        pValue: '0.30',
        delta: '2.00',
        isAnomaly: true,
        value: '35.00',
        ewmaUpper: '30.00',
        ewmaLower: '20.00',
      },
    ]);

    setupKPIAndMoversQueries();
    setupOpportunitiesQueries();
    setupAlertEventsQuery();
    setupDataAsOfQuery();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.kpis).not.toBeNull();
    expect(result.kpis!.trends).toBeDefined();
    expect(result.kpis!.trends!.significantChanges).toHaveLength(1);
    expect(result.kpis!.trends!.significantChanges[0].metric).toBe('recommendation_share');
    expect(result.kpis!.trends!.anomalies).toHaveLength(1);
    expect(result.kpis!.trends!.anomalies[0].metric).toBe('sentiment');
  });

  it('passes date range filtering correctly', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-02-01',
      to: '2026-02-28',
    });

    expect(result.period.from).toBe('2026-02-01');
    expect(result.period.to).toBe('2026-02-28');
  });

  it('MetricBlock shape has all required fields', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    const mb = result.kpis!.recommendationShare;
    expect(mb).toHaveProperty('current');
    expect(mb).toHaveProperty('previous');
    expect(mb).toHaveProperty('delta');
    expect(mb).toHaveProperty('changeRate');
    expect(mb).toHaveProperty('direction');
    expect(mb).toHaveProperty('sparkline');
    expect(Array.isArray(mb.sparkline)).toBe(true);
  });

  it('alert summary forwards correct fields', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    const alerts = result.alerts!;
    expect(alerts.active).toBe(3);
    expect(alerts.total).toBe(10);
    expect(alerts.bySeverity).toEqual({ info: 2, warning: 5, critical: 3 });
    expect(alerts.recentEvents).toHaveLength(1);
    expect(alerts.recentEvents[0].severity).toBe('critical');
  });

  it('platform statuses include health fields without live checks', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    setupFullDashboard();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    const platform = result.platforms![0];
    expect(platform.adapterId).toBe('adapter_1');
    expect(platform.platformId).toBe('chatgpt');
    expect(platform.lastHealthStatus).toBe('healthy');
    expect(platform.lastHealthCheckedAt).toBeDefined();
  });

  it('no prompt set warning when auto-resolve returns nothing', async () => {
    setupDefaultBrands();
    setupDefaultAdapters();
    setupDefaultAlerts();
    pushTableResult('model_run', []);
    setupAlertEventsQuery();

    const getDashboardData = await loadService();
    const result = await getDashboardData('ws_test');

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('prompt set'))).toBe(true);
    expect(result.promptSet.id).toBe('');
  });
});
