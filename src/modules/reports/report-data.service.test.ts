// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRecShareRow, defaultServiceResult } from './report-data.test-helpers';

const mockGetRecommendationShare = vi.fn();
const mockGetSentimentAggregates = vi.fn();
const mockGetPositionAggregates = vi.fn();
const mockGetOpportunities = vi.fn();
const mockGetCitationSources = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

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
vi.mock('@/modules/visibility/geo-score.service', () => ({
  getScoreTrend: vi.fn().mockResolvedValue({
    snapshots: [],
    trend: { delta: null, changeRate: null, direction: null, ewma: [], overallDirection: null },
    formulaVersionChanges: [],
  }),
}));
vi.mock('@/modules/visibility/seo-score.service', () => ({
  getScoreTrend: vi.fn().mockResolvedValue({
    snapshots: [],
    trend: { delta: null, changeRate: null, direction: null, ewma: [], overallDirection: null },
    formulaVersionChanges: [],
  }),
}));
vi.mock('@/lib/db', () => ({
  db: { select: (...a: unknown[]) => mockDbSelect(...a) },
}));
vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));
vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', name: 'name', workspaceId: 'workspaceId' },
}));

function setupDb(brandName = 'TestBrand', promptSetName = 'TestMarket') {
  let callCount = 0;
  mockDbSelect.mockImplementation(() => {
    callCount++;
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ limit: mockDbLimit });
    if (callCount % 2 === 1) {
      mockDbLimit.mockResolvedValueOnce(brandName ? [{ name: brandName }] : []);
    } else {
      mockDbLimit.mockResolvedValueOnce(promptSetName ? [{ name: promptSetName }] : []);
    }
    return { from: mockDbFrom };
  });
}

function setupAllMocks() {
  mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
  mockGetSentimentAggregates.mockResolvedValue(
    defaultServiceResult([
      { periodStart: '2026-03-15', netSentimentScore: '25.00', totalCount: 100 },
    ])
  );
  mockGetPositionAggregates.mockResolvedValue(
    defaultServiceResult(
      [{ periodStart: '2026-03-15', averagePosition: '3.50', citationCount: 10 }],
      1
    )
  );
  mockGetCitationSources.mockResolvedValue(
    defaultServiceResult([{ periodStart: '2026-03-15', domain: 'example.com', frequency: 5 }], 1)
  );
  mockGetOpportunities.mockResolvedValue({
    items: [{ periodStart: '2026-03-15', type: 'missing' }],
    total: 1,
    summary: { totalOpportunities: 3, missingCount: 2, weakCount: 1, averageScore: '0.50' },
  });
}

describe('report-data.service', () => {
  beforeEach(() => vi.clearAllMocks());

  async function loadService() {
    return (await import('./report-data.service')).getReportData;
  }

  it('returns all metrics when no metrics filter specified', async () => {
    setupAllMocks();
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(result.brands).toHaveLength(1);
    const m = result.brands[0].metrics;
    expect(m.recommendationShare).toBeDefined();
    expect(m.citationCount).toBeDefined();
    expect(m.sentiment).toBeDefined();
    expect(m.positions).toBeDefined();
    expect(m.sources).toBeDefined();
    expect(m.opportunities).toBeDefined();
  });

  it('returns only selected metrics when metrics filter provided', async () => {
    setupAllMocks();
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share', 'sentiment'],
    });
    const m = result.brands[0].metrics;
    expect(m.recommendationShare).toBeDefined();
    expect(m.sentiment).toBeDefined();
    expect(m.citationCount).toBeUndefined();
    expect(m.positions).toBeUndefined();
  });

  it('sparkline resolution uses daily for 30-day range', async () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeRecShareRow({
        periodStart: `2026-03-${String(i + 1).padStart(2, '0')}`,
        sharePercentage: '50.00',
      })
    );
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult(items));
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_test',
      expect.objectContaining({ granularity: 'day' }),
      expect.any(Object)
    );
    expect(result.brands[0].metrics.recommendationShare!.sparkline.length).toBeLessThanOrEqual(30);
  });

  it('sparkline resolution uses weekly for 120-day range', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
    setupDb();
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
      })
    );
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult(items));
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-01-01',
      to: '2026-03-31',
      metrics: ['recommendation_share'],
    });
    expect(result.brands[0].metrics.recommendationShare!.sparkline.length).toBeLessThanOrEqual(30);
  });

  it('comparison period dates computed correctly for previous_period', async () => {
    setupAllMocks();
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-15',
      to: '2026-03-31',
      comparisonPeriod: 'previous_period',
      metrics: ['recommendation_share'],
    });
    expect(result.period.comparisonFrom).toBe('2026-02-26');
    expect(result.period.comparisonTo).toBe('2026-03-14');
  });

  it('comparison period dates computed correctly for previous_month', async () => {
    setupAllMocks();
    setupDb();
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
    setupAllMocks();
    let brandCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      brandCallCount++;
      mockDbFrom.mockReturnValue({ where: mockDbWhere });
      mockDbWhere.mockReturnValue({ limit: mockDbLimit });
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

  it('defaults to _all platform and locale when not specified', async () => {
    setupAllMocks();
    setupDb();
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
  });

  it('filters by specific platformId and locale', async () => {
    setupAllMocks();
    setupDb();
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
  });

  it('defaults to 30-day date range when from/to not specified', async () => {
    setupAllMocks();
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metrics: ['recommendation_share'],
    });
    const diffDays = Math.round(
      (new Date(result.period.to).getTime() - new Date(result.period.from).getTime()) / 86_400_000
    );
    expect(diffDays).toBe(30);
  });

  it('partial metric failure omits failed metric', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([makeRecShareRow()]));
    mockGetSentimentAggregates.mockRejectedValue(new Error('DB connection failed'));
    setupDb();
    const getReportData = await loadService();
    const result = await getReportData('ws_test', {
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      from: '2026-03-01',
      to: '2026-03-31',
      metrics: ['recommendation_share', 'sentiment'],
    });
    expect(result.brands[0].metrics.recommendationShare).toBeDefined();
    expect(result.brands[0].metrics.sentiment).toBeUndefined();
  });

  it('unknown brandId is silently excluded from brands array', async () => {
    setupAllMocks();
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
    setupAllMocks();
    mockDbSelect.mockImplementation(() => {
      mockDbFrom.mockReturnValue({ where: mockDbWhere });
      mockDbWhere.mockReturnValue({ limit: mockDbLimit });
      mockDbLimit.mockResolvedValueOnce([]);
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
