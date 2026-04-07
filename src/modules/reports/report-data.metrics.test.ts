// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeRecShareRow,
  makeSentimentRow,
  makePositionRow,
  makeCitationSourceRow,
  defaultServiceResult,
  defaultOpportunityResult,
} from './report-data.test-helpers';

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

describe('report-data metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  async function loadService() {
    return (await import('./report-data.service')).getReportData;
  }

  it('recommendation share metric has correct current/previous/delta/direction', async () => {
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
    setupDb();
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
    setupDb();
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
    setupDb();
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
        return Promise.resolve(
          defaultServiceResult([makePositionRow({ averagePosition: '2.00', citationCount: 10 })], 1)
        );
      }
      return Promise.resolve(
        defaultServiceResult([makePositionRow({ averagePosition: '4.00', citationCount: 10 })], 1)
      );
    });
    setupDb();
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
    expect(p.direction).toBe('up');
  });

  it('sources metric includes topDomains array (top 10)', async () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeCitationSourceRow({ domain: `site${i}.com`, frequency: 15 - i })
    );
    mockGetCitationSources.mockResolvedValue(defaultServiceResult(items, items.length));
    setupDb();
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
    setupDb();
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

  it('returns empty metrics when no data exists for a brand/period', async () => {
    mockGetRecommendationShare.mockResolvedValue(defaultServiceResult([]));
    setupDb();
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
});
