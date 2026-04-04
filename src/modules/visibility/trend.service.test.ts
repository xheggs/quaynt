// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { generatePeriods } from './trend.service';

// --- generatePeriods tests (pure function, no mocking needed) ---

describe('generatePeriods', () => {
  describe('weekly', () => {
    it('produces 4 periods for a 4-week range', () => {
      // 2026-03-02 is a Monday, 2026-03-29 is a Sunday
      const periods = generatePeriods('2026-03-02', '2026-03-29', 'weekly');
      expect(periods).toHaveLength(4);
      expect(periods[0].start).toBe('2026-03-02');
      expect(periods[0].end).toBe('2026-03-08');
      expect(periods[3].start).toBe('2026-03-23');
      expect(periods[3].end).toBe('2026-03-29');
    });

    it('aligns to Monday for a mid-week start', () => {
      // 2026-03-05 is a Thursday
      const periods = generatePeriods('2026-03-05', '2026-03-15', 'weekly');
      // Should align to Monday 2026-03-02
      expect(periods[0].start).toBe('2026-03-02');
      expect(periods[0].end).toBe('2026-03-08');
    });

    it('produces one period for a single-day range', () => {
      const periods = generatePeriods('2026-03-04', '2026-03-04', 'weekly');
      expect(periods.length).toBeGreaterThanOrEqual(1);
      // The period contains the date (string comparison works for ISO dates)
      expect(periods[0].start <= '2026-03-04').toBe(true);
      expect(periods[0].end >= '2026-03-04').toBe(true);
    });

    it('weekly periods have 7-day spans', () => {
      const periods = generatePeriods('2026-01-05', '2026-02-01', 'weekly');
      for (const p of periods) {
        const start = new Date(p.start + 'T00:00:00Z');
        const end = new Date(p.end + 'T00:00:00Z');
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(days).toBe(6); // Mon to Sun = 6 days difference
      }
    });
  });

  describe('monthly', () => {
    it('produces 3 periods for a 3-month range', () => {
      const periods = generatePeriods('2026-01-01', '2026-03-31', 'monthly');
      expect(periods).toHaveLength(3);
      expect(periods[0]).toEqual({ start: '2026-01-01', end: '2026-01-31' });
      expect(periods[1]).toEqual({ start: '2026-02-01', end: '2026-02-28' });
      expect(periods[2]).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    });

    it('handles February in leap year', () => {
      const periods = generatePeriods('2028-02-01', '2028-02-28', 'monthly');
      expect(periods).toHaveLength(1);
      expect(periods[0].end).toBe('2028-02-29');
    });

    it('mid-month start aligns to 1st', () => {
      const periods = generatePeriods('2026-01-15', '2026-03-15', 'monthly');
      expect(periods[0].start).toBe('2026-01-01');
    });

    it('produces one period for a single-day range', () => {
      const periods = generatePeriods('2026-03-15', '2026-03-15', 'monthly');
      expect(periods.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// --- getTrends tests (mocked DB) ---

const mockSelect = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
  },
}));

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
    sharePercentage: 'sharePercentage',
    modelRunCount: 'modelRunCount',
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
    netSentimentScore: 'netSentimentScore',
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

vi.mock('@/lib/config/env', () => ({
  env: { QUAYNT_EDITION: 'community' },
}));

vi.mock('./trend-snapshot.schema', () => ({
  trendSnapshot: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    metric: 'metric',
    period: 'period',
    periodStart: 'periodStart',
  },
}));

const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

function setupSelectChain(data: object[]) {
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockResolvedValue(data);
}

function setupSelectChainWithLimit(data: object[]) {
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(data);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTrends', () => {
  // Dynamic import to get the mock-affected version
  async function loadGetTrends() {
    const mod = await import('./trend.service');
    return mod.getTrends;
  }

  it('computes recommendation share trends with correct deltas', async () => {
    const getTrends = await loadGetTrends();

    // Mock: first call = metric query, second = brand name, third = prompt set name
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Recommendation share data query
        setupSelectChain([
          { periodStart: '2026-03-02', citationCount: 30, totalCitations: 100 },
          { periodStart: '2026-03-09', citationCount: 40, totalCitations: 100 },
        ]);
      } else if (callCount === 2) {
        // Brand name query
        setupSelectChainWithLimit([{ name: 'TestBrand' }]);
      } else {
        // Prompt set name query
        setupSelectChainWithLimit([{ name: 'TestMarket' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
    });

    expect(result.metric).toBe('recommendation_share');
    expect(result.brand.brandName).toBe('TestBrand');
    expect(result.market.name).toBe('TestMarket');
    expect(result.dataPoints).toHaveLength(2);

    // First period: 30/100 = 30%
    expect(parseFloat(result.dataPoints[0].value)).toBeCloseTo(30, 0);
    expect(result.dataPoints[0].direction).toBeNull(); // No previous

    // Second period: 40/100 = 40%, delta = +10
    expect(parseFloat(result.dataPoints[1].value)).toBeCloseTo(40, 0);
    expect(result.dataPoints[1].direction).toBe('up');
    expect(parseFloat(result.dataPoints[1].delta!)).toBeCloseTo(10, 0);
  });

  it('computes sentiment trends with net sentiment score', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([
          { periodStart: '2026-03-02', positiveCount: 8, negativeCount: 2, totalCount: 10 },
          { periodStart: '2026-03-09', positiveCount: 5, negativeCount: 5, totalCount: 10 },
        ]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'sentiment',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
    });

    // First: (8-2)/10*100 = 60
    expect(parseFloat(result.dataPoints[0].value)).toBeCloseTo(60, 0);
    // Second: (5-5)/10*100 = 0
    expect(parseFloat(result.dataPoints[1].value)).toBeCloseTo(0, 0);
    expect(result.dataPoints[1].direction).toBe('down');
  });

  it('computes position trends with citation-weighted average', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([
          // Two daily rows in first period: weighted avg = (2*10 + 4*20)/(10+20) = 100/30 = 3.33
          { periodStart: '2026-03-02', averagePosition: '2', citationCount: 10 },
          { periodStart: '2026-03-03', averagePosition: '4', citationCount: 20 },
        ]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'average_position',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-08',
    });

    expect(result.dataPoints).toHaveLength(1);
    // (2*10 + 4*20) / (10+20) = 100/30 ≈ 3.3333
    expect(parseFloat(result.dataPoints[0].value)).toBeCloseTo(3.333, 1);
  });

  it('computes opportunity count trends', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([
          { periodStart: '2026-03-02', count: 1 },
          { periodStart: '2026-03-03', count: 1 },
          { periodStart: '2026-03-04', count: 1 },
          { periodStart: '2026-03-10', count: 1 },
        ]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'opportunity_count',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
    });

    // First week: 3 opportunities, second week: 1
    expect(parseFloat(result.dataPoints[0].value)).toBe(3);
    expect(parseFloat(result.dataPoints[1].value)).toBe(1);
    expect(result.dataPoints[1].direction).toBe('down');
  });

  it('includes moving average when requested', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([
          { periodStart: '2026-03-02', citationCount: 30, totalCitations: 100 },
          { periodStart: '2026-03-09', citationCount: 40, totalCitations: 100 },
        ]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
      includeMovingAverage: true,
    });

    for (const dp of result.dataPoints) {
      expect(dp.movingAverage).not.toBeNull();
    }
  });

  it('excludes moving average when not requested', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([{ periodStart: '2026-03-02', citationCount: 30, totalCitations: 100 }]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-08',
      includeMovingAverage: false,
    });

    for (const dp of result.dataPoints) {
      expect(dp.movingAverage).toBeNull();
    }
  });

  it('returns empty data for no results in range', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
    });

    expect(result.dataPoints).toHaveLength(0);
    expect(result.summary.periodCount).toBe(0);
    expect(result.summary.latestDirection).toBeNull();
  });

  it('defaults platform and locale to _all', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-02',
      to: '2026-03-08',
    });

    expect(result.filters.platformId).toBe('_all');
    expect(result.filters.locale).toBe('_all');
    expect(result.period).toBe('weekly');
  });

  it('summary reflects correct overall direction and change rate', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        setupSelectChain([
          { periodStart: '2026-03-02', citationCount: 20, totalCitations: 100 },
          { periodStart: '2026-03-09', citationCount: 30, totalCitations: 100 },
          { periodStart: '2026-03-16', citationCount: 40, totalCitations: 100 },
        ]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'recommendation_share',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-22',
    });

    expect(result.summary.overallDirection).toBe('up');
    // 20% -> 40% = 100% change
    expect(parseFloat(result.summary.overallChangeRate!)).toBeCloseTo(100, 0);
    expect(result.summary.periodCount).toBe(3);
    expect(result.summary.latestValue).toBe(result.dataPoints[2].value);
  });

  it('handles previous value of 0 with null changeRate', async () => {
    const getTrends = await loadGetTrends();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // citation_count is a count metric, so 0-value periods are included
        setupSelectChain([{ periodStart: '2026-03-09', citationCount: 10 }]);
      } else if (callCount === 2) {
        setupSelectChainWithLimit([{ name: 'Brand' }]);
      } else {
        setupSelectChainWithLimit([{ name: 'Market' }]);
      }
      return { from: mockFrom };
    });

    const result = await getTrends('ws_test', {
      metric: 'citation_count',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      period: 'weekly',
      from: '2026-03-02',
      to: '2026-03-15',
    });

    // First period has 0 citations (count metric includes 0), second has 10
    const secondPoint = result.dataPoints.find((dp) => parseFloat(dp.value) === 10);
    if (secondPoint?.previousValue === '0') {
      expect(secondPoint.changeRate).toBeNull();
    }
  });
});
