// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock DB
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflict = vi.fn();
const mockReturning = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    insert: (...a: unknown[]) => mockInsert(...a),
    select: (...a: unknown[]) => mockSelect(...a),
  },
}));

vi.mock('./trend-snapshot.schema', () => ({
  trendSnapshot: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    metric: 'metric',
    period: 'period',
    periodStart: 'periodStart',
    periodEnd: 'periodEnd',
    value: 'value',
    previousValue: 'previousValue',
    delta: 'delta',
    changeRate: 'changeRate',
    ewmaValue: 'ewmaValue',
    ewmaUpper: 'ewmaUpper',
    ewmaLower: 'ewmaLower',
    isAnomaly: 'isAnomaly',
    anomalyDirection: 'anomalyDirection',
    isSignificant: 'isSignificant',
    pValue: 'pValue',
    confidenceLower: 'confidenceLower',
    confidenceUpper: 'confidenceUpper',
    sampleSize: 'sampleSize',
    updatedAt: 'updatedAt',
  },
}));

// Mock all source schemas
vi.mock('./recommendation-share.schema', () => ({
  recommendationShare: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    citationCount: 'citationCount',
    totalCitations: 'totalCitations',
  },
}));

vi.mock('./sentiment-aggregate.schema', () => ({
  sentimentAggregate: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    positiveCount: 'positiveCount',
    negativeCount: 'negativeCount',
    totalCount: 'totalCount',
  },
}));

vi.mock('./position-aggregate.schema', () => ({
  positionAggregate: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    averagePosition: 'averagePosition',
    citationCount: 'citationCount',
    firstMentionCount: 'firstMentionCount',
  },
}));

vi.mock('./opportunity.schema', () => ({
  opportunity: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    periodStart: 'periodStart',
  },
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));

vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));

function setupMetricQuery(rows: object[]) {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockResolvedValue(rows);
}

function setupInsertChain() {
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
  mockOnConflict.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([{ id: 'tsnap_test' }]);
}

// Pin "now" so the 12-week history window in computeTrendSnapshots deterministically
// contains the fixture rows (which start 2026-01-05).
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupInsertChain();
});

describe('computeTrendSnapshots', () => {
  async function loadCompute() {
    const mod = await import('./trend-snapshot.compute');
    return mod.computeTrendSnapshots;
  }

  it('computes snapshots for stable recommendation share data', async () => {
    const compute = await loadCompute();

    // Generate enough weeks of stable data
    const rows = [];
    const baseDate = new Date('2026-01-05');
    for (let w = 0; w < 10; w++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + w * 7);
      rows.push({
        periodStart: d.toISOString().slice(0, 10),
        citationCount: 30,
        totalCitations: 100,
      });
    }
    setupMetricQuery(rows);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result.changed).toBe(true);
    expect(result.anomalyCount).toBe(0);
    // Should have inserted snapshot rows
    expect(mockInsert).toHaveBeenCalled();
  });

  it('detects anomaly for sudden spike in data', async () => {
    const compute = await loadCompute();

    const rows = [];
    const baseDate = new Date('2026-01-05');
    // 8 weeks of stable data at 30%
    for (let w = 0; w < 8; w++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + w * 7);
      rows.push({
        periodStart: d.toISOString().slice(0, 10),
        citationCount: 30,
        totalCitations: 100,
      });
    }
    // Week 9: sudden spike to 80%
    const spikeDate = new Date(baseDate);
    spikeDate.setUTCDate(spikeDate.getUTCDate() + 8 * 7);
    rows.push({
      periodStart: spikeDate.toISOString().slice(0, 10),
      citationCount: 80,
      totalCitations: 100,
    });
    setupMetricQuery(rows);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result.anomalyCount).toBeGreaterThan(0);
  });

  it('marks significance for large recommendation share change', async () => {
    const compute = await loadCompute();

    const rows = [];
    const baseDate = new Date('2026-01-05');
    // 5 weeks stable at 20/100 then jump to 60/100
    for (let w = 0; w < 5; w++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + w * 7);
      rows.push({
        periodStart: d.toISOString().slice(0, 10),
        citationCount: 20,
        totalCitations: 100,
      });
    }
    const jumpDate = new Date(baseDate);
    jumpDate.setUTCDate(jumpDate.getUTCDate() + 5 * 7);
    rows.push({
      periodStart: jumpDate.toISOString().slice(0, 10),
      citationCount: 60,
      totalCitations: 100,
    });
    setupMetricQuery(rows);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result.changed).toBe(true);
    // Verify significance was computed by checking the insert call args
    const insertCalls = mockValues.mock.calls;
    const lastInsert = insertCalls[insertCalls.length - 1]?.[0];
    if (lastInsert) {
      expect(lastInsert.isSignificant).toBe(true);
      expect(parseFloat(lastInsert.pValue)).toBeLessThan(0.05);
    }
  });

  it('returns unchanged for empty data', async () => {
    const compute = await loadCompute();
    setupMetricQuery([]);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result.changed).toBe(false);
    expect(result.anomalyCount).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('sets null significance for insufficient data (< 4 periods)', async () => {
    const compute = await loadCompute();

    setupMetricQuery([
      { periodStart: '2026-03-02', citationCount: 30, totalCitations: 100 },
      { periodStart: '2026-03-09', citationCount: 40, totalCitations: 100 },
    ]);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result.changed).toBe(true);
    // All inserted rows should have null significance
    for (const call of mockValues.mock.calls) {
      const row = call[0];
      expect(row.isSignificant).toBeNull();
      expect(row.pValue).toBeNull();
    }
  });

  it('skips significance for average_position metric', async () => {
    const compute = await loadCompute();

    const rows = [];
    const baseDate = new Date('2026-01-05');
    for (let w = 0; w < 6; w++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + w * 7);
      rows.push({
        periodStart: d.toISOString().slice(0, 10),
        averagePosition: '2.5',
        citationCount: 10,
      });
    }
    setupMetricQuery(rows);

    const result = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'average_position',
      period: 'weekly',
    });

    expect(result.changed).toBe(true);
    // Significance should be null for position metrics
    for (const call of mockValues.mock.calls) {
      const row = call[0];
      expect(row.isSignificant).toBeNull();
    }
  });

  it('idempotent: re-running produces same shape of result', async () => {
    const compute = await loadCompute();

    const rows = [
      { periodStart: '2026-03-02', citationCount: 30, totalCitations: 100 },
      { periodStart: '2026-03-09', citationCount: 40, totalCitations: 100 },
      { periodStart: '2026-03-16', citationCount: 35, totalCitations: 100 },
      { periodStart: '2026-03-23', citationCount: 38, totalCitations: 100 },
      { periodStart: '2026-03-30', citationCount: 42, totalCitations: 100 },
    ];
    setupMetricQuery(rows);

    const result1 = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    vi.clearAllMocks();
    setupInsertChain();
    setupMetricQuery(rows);

    const result2 = await compute({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(result1.anomalyCount).toBe(result2.anomalyCount);
  });
});
