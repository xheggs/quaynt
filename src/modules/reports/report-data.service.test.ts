// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRecommendationShare = vi.fn();
const mockGetSentimentAggregates = vi.fn();
const mockGetPositionAggregates = vi.fn();
const mockGetOpportunities = vi.fn();
const mockGetCitationSources = vi.fn();

vi.mock('@/modules/visibility/recommendation-share.service', () => ({
  getRecommendationShare: (...args: unknown[]) => mockGetRecommendationShare(...args),
}));
vi.mock('@/modules/visibility/sentiment-aggregate.service', () => ({
  getSentimentAggregates: (...args: unknown[]) => mockGetSentimentAggregates(...args),
}));
vi.mock('@/modules/visibility/position-aggregate.service', () => ({
  getPositionAggregates: (...args: unknown[]) => mockGetPositionAggregates(...args),
}));
vi.mock('@/modules/visibility/opportunity.service', () => ({
  getOpportunities: (...args: unknown[]) => mockGetOpportunities(...args),
}));
vi.mock('@/modules/visibility/citation-source-aggregate.service', () => ({
  getCitationSources: (...args: unknown[]) => mockGetCitationSources(...args),
}));

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...a: unknown[]) => mockDbSelect(...a),
  },
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));
vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));

function makeRecShareRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    sharePercentage: '50.00',
    citationCount: 5,
    totalCitations: 10,
    ...overrides,
  };
}

function makeSentimentRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    netSentimentScore: '25.00',
    totalCount: 100,
    positiveCount: 50,
    neutralCount: 25,
    negativeCount: 25,
    ...overrides,
  };
}

function makePositionRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    averagePosition: '3.50',
    citationCount: 10,
    ...overrides,
  };
}

function makeCitationSourceRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    domain: 'example.com',
    frequency: 5,
    ...overrides,
  };
}

function defaultServiceResult(items: unknown[] = [], total = 0) {
  return { items, total };
}

function defaultOpportunityResult(
  items: unknown[] = [],
  summary = { totalOpportunities: 0, missingCount: 0, weakCount: 0, averageScore: '0.00' }
) {
  return { items, total: items.length, summary };
}

function setupDbForBrandAndPromptSet(brandName = 'TestBrand', promptSetName = 'TestMarket') {
  let callCount = 0;
  mockDbSelect.mockImplementation(() => {
    callCount++;
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ limit: mockDbLimit });
    // Brand lookups come first, then prompt set
    if (callCount % 2 === 1) {
      mockDbLimit.mockResolvedValueOnce(brandName ? [{ name: brandName }] : []);
    } else {
      mockDbLimit.mockResolvedValueOnce(promptSetName ? [{ name: promptSetName }] : []);
    }
    return { from: mockDbFrom };
  });
}

function setupAllMetricMocks() {
  mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
  mockGetSentimentAggregates.mockResolvedValue(defaultServiceResult([makeSentimentRow()]));
  mockGetPositionAggregates.mockResolvedValue(defaultServiceResult([makePositionRow()], 1));
  mockGetCitationSources.mockResolvedValue(defaultServiceResult([makeCitationSourceRow()], 1));
  mockGetOpportunities.mockResolvedValue(
    defaultOpportunityResult([{ periodStart: '2026-03-15', type: 'missing' }], {
      totalOpportunities: 3,
      missingCount: 2,
      weakCount: 1,
      averageScore: '0.50',
    })
  );
}

describe('report-data.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadService() {
    const mod = await import('./report-data.service');
    return mod.getReportData;
  }

  it('returns all metrics when no metrics filter specified', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.brands).toHaveLength(1);
    const metrics = result.brands[0].metrics;
    expect(metrics.recommendationShare).toBeDefined();
    expect(metrics.citationCount).toBeDefined();
    expect(metrics.sentiment).toBeDefined();
    expect(metrics.positions).toBeDefined();
    expect(metrics.sources).toBeDefined();
    expect(metrics.opportunities).toBeDefined();
  });

  it('returns only selected metrics when metrics filter provided', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share', 'sentiment'],
    });

    const metrics = result.brands[0].metrics;
    expect(metrics.recommendationShare).toBeDefined();
    expect(metrics.sentiment).toBeDefined();
    expect(metrics.citationCount).toBeUndefined();
    expect(metrics.positions).toBeUndefined();
    expect(metrics.sources).toBeUndefined();
    expect(metrics.opportunities).toBeUndefined();
  });

  it('recommendation share metric has correct current/previous/delta/direction', async () => {
    // Current: 5/10 = 50%, Comparison: 3/10 = 30%
    mockGetRecommendationShare.mockImplementation((_ws: unknown, filters: { from?: string }) => {
      if (filters.from === '2026-03-01') {
        return Promise.resolve(
          defaultServiceResult([
            makeRecShareRow({ citationCount: 5, totalCitations: 10, sharePercentage: '50.00' }),
          ])
        );
      }
      return Promise.resolve(
        defaultServiceResult([
          makeRecShareRow({ citationCount: 3, totalCitations: 10, sharePercentage: '30.00' }),
        ])
      );
    });
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    const rs = result.brands[0].metrics.recommendationShare!;
    expect(rs.current).toBe('50.00');
    expect(rs.previous).toBe('30.00');
    expect(rs.delta).toBe('20.00');
    expect(rs.direction).toBe('up');
    expect(rs.changeRate).toBeDefined();
  });

  it('citation count metric aggregates correctly', async () => {
    mockGetRecommendationShare.mockImplementation((_ws: unknown, filters: { from?: string }) => {
      if (filters.from === '2026-03-01') {
        return Promise.resolve(
          defaultServiceResult([
            makeRecShareRow({ citationCount: 10 }),
            makeRecShareRow({ citationCount: 5, periodStart: '2026-03-16' }),
          ])
        );
      }
      return Promise.resolve(defaultServiceResult([makeRecShareRow({ citationCount: 8 })]));
    });
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['citation_count'],
    });

    const cc = result.brands[0].metrics.citationCount!;
    expect(cc.current).toBe('15.00');
    expect(cc.previous).toBe('8.00');
    expect(cc.delta).toBe('7.00');
    expect(cc.direction).toBe('up');
  });

  it('sentiment metric uses netSentimentScore as primary value', async () => {
    mockGetSentimentAggregates.mockImplementation((_ws: unknown, filters: { from?: string }) => {
      if (filters.from === '2026-03-01') {
        return Promise.resolve(
          defaultServiceResult([makeSentimentRow({ netSentimentScore: '40.00', totalCount: 100 })])
        );
      }
      return Promise.resolve(
        defaultServiceResult([makeSentimentRow({ netSentimentScore: '20.00', totalCount: 100 })])
      );
    });
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['sentiment'],
    });

    const s = result.brands[0].metrics.sentiment!;
    expect(s.current).toBe('40.00');
    expect(s.previous).toBe('20.00');
    expect(s.direction).toBe('up');
  });

  it('position metric inverts direction (lower = better)', async () => {
    mockGetPositionAggregates.mockImplementation((_ws: unknown, filters: { from?: string }) => {
      if (filters.from === '2026-03-01') {
        // Current: position 2.00 (better)
        return Promise.resolve(
          defaultServiceResult([makePositionRow({ averagePosition: '2.00', citationCount: 10 })], 1)
        );
      }
      // Previous: position 4.00 (worse)
      return Promise.resolve(
        defaultServiceResult([makePositionRow({ averagePosition: '4.00', citationCount: 10 })], 1)
      );
    });
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['positions'],
    });

    const p = result.brands[0].metrics.positions!;
    expect(p.current).toBe('2.00');
    expect(p.previous).toBe('4.00');
    expect(p.delta).toBe('-2.00');
    // Lower position is better, so direction should be "up" (improvement)
    expect(p.direction).toBe('up');
  });

  it('sources metric includes topDomains array (top 10)', async () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeCitationSourceRow({ domain: `site${i}.com`, frequency: 15 - i })
    );
    mockGetCitationSources.mockResolvedValue(defaultServiceResult(items, items.length));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['sources'],
    });

    const s = result.brands[0].metrics.sources!;
    expect(s.topDomains).toHaveLength(10);
    expect(s.topDomains[0].domain).toBe('site0.com');
    expect(s.topDomains[0].frequency).toBe(15);
  });

  it('opportunities metric includes byType breakdown', async () => {
    mockGetOpportunities.mockResolvedValue(
      defaultOpportunityResult([{ periodStart: '2026-03-15', type: 'missing' }], {
        totalOpportunities: 5,
        missingCount: 3,
        weakCount: 2,
        averageScore: '0.60',
      })
    );
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['opportunities'],
    });

    const o = result.brands[0].metrics.opportunities!;
    expect(o.byType.missing).toBe(3);
    expect(o.byType.weak).toBe(2);
  });

  it('sparkline resolution uses daily for 30-day range', async () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeRecShareRow({
        periodStart: `2026-03-${String(i + 1).padStart(2, '0')}`,
        sharePercentage: '50.00',
      })
    );
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult(items));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    // Should call getRecommendationShare with granularity 'day'
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_test',
      expect.objectContaining({ granularity: 'day' }),
      expect.any(Object)
    );
    const rs = result.brands[0].metrics.recommendationShare!;
    expect(rs.sparkline.length).toBeGreaterThan(0);
    expect(rs.sparkline.length).toBeLessThanOrEqual(30);
  });

  it('sparkline resolution uses weekly for 120-day range', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2025-12-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_test',
      expect.objectContaining({ granularity: 'week' }),
      expect.any(Object)
    );
  });

  it('sparkline points are capped at 30', async () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      makeRecShareRow({
        periodStart: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        sharePercentage: '50.00',
      })
    );
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult(items));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-01-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    const rs = result.brands[0].metrics.recommendationShare!;
    expect(rs.sparkline.length).toBeLessThanOrEqual(30);
  });

  it('comparison period dates computed correctly for previous_period', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-15',
      to: '2026-03-31',
      comparisonPeriod: 'previous_period',
      metrics: ['recommendation_share'],
    });

    // 16-day span, so comparison = Mar 15 minus 1 day = Mar 14 (end), minus 16 days span = Feb 26 (start)
    expect(result.period.comparisonFrom).toBe('2026-02-26');
    expect(result.period.comparisonTo).toBe('2026-03-14');
  });

  it('comparison period dates computed correctly for previous_month', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      comparisonPeriod: 'previous_month',
      metrics: ['recommendation_share'],
    });

    expect(result.period.comparisonFrom).toBe('2026-02-01');
    expect(result.period.comparisonTo).toBe('2026-02-28');
  });

  it('multi-brand report returns separate metric blocks per brand', async () => {
    setupAllMetricMocks();
    let brandCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      brandCallCount++;
      mockDbFrom.mockReturnValue({ where: mockDbWhere });
      mockDbWhere.mockReturnValue({ limit: mockDbLimit });
      // Alternate brand/promptSet lookups; 2 brands means 2 brand lookups + 1 promptSet
      if (brandCallCount <= 2) {
        mockDbLimit.mockResolvedValueOnce([{ name: `Brand${brandCallCount}` }]);
      } else {
        mockDbLimit.mockResolvedValueOnce([{ name: 'TestMarket' }]);
      }
      return { from: mockDbFrom };
    });
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandIds: ['brand_1', 'brand_2'],
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    expect(result.brands).toHaveLength(2);
    expect(result.brands[0].brand.brandId).toBe('brand_1');
    expect(result.brands[1].brand.brandId).toBe('brand_2');
  });

  it('returns empty metrics when no data exists for a brand/period', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([]));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    const rs = result.brands[0].metrics.recommendationShare!;
    expect(rs.current).toBe('0.00');
    expect(rs.previous).toBeNull();
    expect(rs.delta).toBeNull();
    expect(rs.direction).toBeNull();
    expect(rs.sparkline).toEqual([]);
  });

  it('defaults to _all platform and locale when not specified', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });

    expect(result.filters.platformId).toBe('_all');
    expect(result.filters.locale).toBe('_all');
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_test',
      expect.objectContaining({ platformId: '_all', locale: '_all' }),
      expect.any(Object)
    );
  });

  it('filters by specific platformId and locale', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      platformId: 'chatgpt',
      locale: 'en-US',
      metrics: ['recommendation_share'],
    });

    expect(result.filters.platformId).toBe('chatgpt');
    expect(result.filters.locale).toBe('en-US');
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_test',
      expect.objectContaining({ platformId: 'chatgpt', locale: 'en-US' }),
      expect.any(Object)
    );
  });

  it('defaults to 30-day date range when from/to not specified', async () => {
    setupAllMetricMocks();
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metrics: ['recommendation_share'],
    });

    const from = new Date(result.period.from);
    const to = new Date(result.period.to);
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(diffDays).toBe(30);
  });

  it('partial metric failure populates warnings array and omits failed metric', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
    mockGetSentimentAggregates.mockRejectedValue(new Error('DB connection failed'));
    setupDbForBrandAndPromptSet();
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share', 'sentiment'],
    });

    const metrics = result.brands[0].metrics;
    expect(metrics.recommendationShare).toBeDefined();
    expect(metrics.sentiment).toBeUndefined();
  });

  it('unknown brandId is silently excluded from brands array', async () => {
    setupAllMetricMocks();
    // Brand lookup returns empty (not found)
    mockDbSelect.mockImplementation(() => {
      mockDbFrom.mockReturnValue({ where: mockDbWhere });
      mockDbWhere.mockReturnValue({ limit: mockDbLimit });
      mockDbLimit.mockResolvedValueOnce([]);
      return { from: mockDbFrom };
    });
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'unknown_brand',
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.brands).toHaveLength(0);
  });

  it('all unknown brandIds returns empty brands array', async () => {
    setupAllMetricMocks();
    mockDbSelect.mockImplementation(() => {
      mockDbFrom.mockReturnValue({ where: mockDbWhere });
      mockDbWhere.mockReturnValue({ limit: mockDbLimit });
      mockDbLimit.mockResolvedValueOnce([]); // brand not found
      return { from: mockDbFrom };
    });
    const getReportData = await loadService();

    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandIds: ['unknown_1', 'unknown_2'],
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(result.brands).toHaveLength(0);
  });
});
