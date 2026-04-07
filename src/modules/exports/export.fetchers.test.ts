// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReportDataResponse } from '@/modules/reports/report-data.types';

const mockGetReportData = vi.fn();
const mockListCitations = vi.fn();
const mockGetRecommendationShare = vi.fn();
const mockGetSentimentAggregates = vi.fn();
const mockGetPositionAggregates = vi.fn();
const mockGetOpportunities = vi.fn();

vi.mock('@/modules/reports/report-data.service', () => ({
  getReportData: (...args: unknown[]) => mockGetReportData(...args),
}));

vi.mock('@/modules/reports/report-data.types', () => ({
  VALID_REPORT_METRICS: [
    'recommendation_share',
    'citation_count',
    'sentiment',
    'positions',
    'sources',
    'opportunities',
  ],
}));

vi.mock('@/modules/citations/citation.service', () => ({
  listCitations: (...args: unknown[]) => mockListCitations(...args),
  CITATION_ALLOWED_SORTS: ['createdAt'],
}));

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

async function collectRows(
  rows: AsyncIterable<Record<string, unknown>>
): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for await (const row of rows) {
    result.push(row);
  }
  return result;
}

const sampleReportResult: ReportDataResponse = {
  market: { promptSetId: 'ps_1', name: 'Test Market' },
  period: {
    from: '2026-03-01',
    to: '2026-03-31',
    comparisonFrom: '2026-01-29',
    comparisonTo: '2026-02-28',
  },
  filters: { platformId: '_all', locale: '_all' },
  brands: [
    {
      brand: { brandId: 'brand_1', brandName: 'Acme' },
      metrics: {
        recommendationShare: {
          current: '50.00',
          previous: '40.00',
          delta: '10.00',
          changeRate: '25.00',
          direction: 'up',
          sparkline: [],
        },
        citationCount: {
          current: '100.00',
          previous: '80.00',
          delta: '20.00',
          changeRate: '25.00',
          direction: 'up',
          sparkline: [],
        },
      },
    },
  ],
  warnings: ['sentiment: partial data'],
};

describe('fetchExportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('report fetcher', () => {
    it('flattens report data into one row per brand per metric', async () => {
      mockGetReportData.mockResolvedValueOnce(sampleReportResult);

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('report', 'ws_1', {
        promptSetId: 'ps_1',
        brandId: 'brand_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(2); // recommendationShare + citationCount
      expect(rows[0]).toMatchObject({
        brandName: 'Acme',
        brandId: 'brand_1',
        market: 'Test Market',
        metric: 'recommendation_share',
        currentValue: '50.00',
      });
      expect(rows[1]).toMatchObject({
        metric: 'citation_count',
        currentValue: '100.00',
      });
    });

    it('passes through warnings from report data', async () => {
      mockGetReportData.mockResolvedValueOnce(sampleReportResult);

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('report', 'ws_1', {
        promptSetId: 'ps_1',
        brandId: 'brand_1',
      });

      expect(result.warnings).toEqual(['sentiment: partial data']);
    });

    it('returns empty iterable when no brands', async () => {
      mockGetReportData.mockResolvedValueOnce({
        ...sampleReportResult,
        brands: [],
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('report', 'ws_1', {
        promptSetId: 'ps_1',
        brandId: 'brand_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(0);
    });
  });

  describe('citations fetcher', () => {
    it('returns correct row shape', async () => {
      mockListCitations.mockResolvedValueOnce({
        items: [
          {
            id: 'c_1',
            workspaceId: 'ws_1',
            brandId: 'brand_1',
            modelRunId: 'mr_1',
            modelRunResultId: 'mrr_1',
            platformId: 'chatgpt',
            citationType: 'owned',
            position: 1,
            contextSnippet: 'test snippet',
            relevanceSignal: 'domain_match',
            sourceUrl: 'https://example.com/page',
            title: 'Test Page',
            locale: 'en-US',
            sentimentLabel: 'positive',
            sentimentScore: '0.85',
            sentimentConfidence: '0.90',
            createdAt: new Date('2026-03-15'),
            updatedAt: new Date('2026-03-15'),
          },
        ],
        total: 1,
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('citations', 'ws_1', {});

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brandId: 'brand_1',
        platform: 'chatgpt',
        citationType: 'owned',
        title: 'Test Page',
        sourceUrl: 'https://example.com/page',
        domain: 'example.com',
        position: 1,
        sentimentLabel: 'positive',
        createdAt: '2026-03-15',
      });
    });

    it('paginates through results', async () => {
      // Page 1: full page
      mockListCitations.mockResolvedValueOnce({
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: `c_${i}`,
          workspaceId: 'ws_1',
          brandId: 'brand_1',
          modelRunId: 'mr_1',
          modelRunResultId: 'mrr_1',
          platformId: 'chatgpt',
          citationType: 'owned',
          position: i,
          contextSnippet: null,
          relevanceSignal: 'domain_match',
          sourceUrl: 'https://example.com',
          title: null,
          locale: null,
          sentimentLabel: null,
          sentimentScore: null,
          sentimentConfidence: null,
          createdAt: new Date('2026-03-15'),
          updatedAt: new Date('2026-03-15'),
        })),
        total: 1500,
      });

      // Page 2: partial page
      mockListCitations.mockResolvedValueOnce({
        items: Array.from({ length: 500 }, (_, i) => ({
          id: `c_${1000 + i}`,
          workspaceId: 'ws_1',
          brandId: 'brand_1',
          modelRunId: 'mr_1',
          modelRunResultId: 'mrr_1',
          platformId: 'chatgpt',
          citationType: 'owned',
          position: 1000 + i,
          contextSnippet: null,
          relevanceSignal: 'domain_match',
          sourceUrl: 'https://example.com',
          title: null,
          locale: null,
          sentimentLabel: null,
          sentimentScore: null,
          sentimentConfidence: null,
          createdAt: new Date('2026-03-15'),
          updatedAt: new Date('2026-03-15'),
        })),
        total: 1500,
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('citations', 'ws_1', {});

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1500);
      expect(mockListCitations).toHaveBeenCalledTimes(2);
    });

    it('returns empty iterable when no results', async () => {
      mockListCitations.mockResolvedValueOnce({ items: [], total: 0 });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('citations', 'ws_1', {});

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(0);
    });
  });

  describe('recommendation-share fetcher', () => {
    it('returns correct row shape', async () => {
      mockGetRecommendationShare.mockResolvedValueOnce({
        items: [
          {
            id: 'rs_1',
            workspaceId: 'ws_1',
            brandId: 'brand_1',
            promptSetId: 'ps_1',
            platformId: 'chatgpt',
            locale: 'en-US',
            periodStart: '2026-03-01',
            sharePercentage: '50.00',
            citationCount: 100,
            totalCitations: 200,
            modelRunCount: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('recommendation-share', 'ws_1', {
        promptSetId: 'ps_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brandId: 'brand_1',
        platform: 'chatgpt',
        locale: 'en-US',
        periodStart: '2026-03-01',
        sharePercentage: '50.00',
        citationCount: 100,
        totalCitations: 200,
      });
    });
  });

  describe('sentiment fetcher', () => {
    it('returns correct row shape', async () => {
      mockGetSentimentAggregates.mockResolvedValueOnce({
        items: [
          {
            id: 'sa_1',
            workspaceId: 'ws_1',
            brandId: 'brand_1',
            promptSetId: 'ps_1',
            platformId: 'chatgpt',
            locale: 'en-US',
            periodStart: '2026-03-01',
            positiveCount: 50,
            neutralCount: 30,
            negativeCount: 20,
            totalCount: 100,
            netSentimentScore: '0.30',
            averageScore: '0.65',
            modelRunCount: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('sentiment', 'ws_1', {
        promptSetId: 'ps_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brandId: 'brand_1',
        positiveCount: 50,
        neutralCount: 30,
        negativeCount: 20,
        netSentimentScore: '0.30',
      });
    });
  });

  describe('positions fetcher', () => {
    it('returns correct row shape', async () => {
      mockGetPositionAggregates.mockResolvedValueOnce({
        items: [
          {
            id: 'pa_1',
            workspaceId: 'ws_1',
            brandId: 'brand_1',
            promptSetId: 'ps_1',
            platformId: 'chatgpt',
            locale: 'en-US',
            periodStart: '2026-03-01',
            citationCount: 50,
            averagePosition: '2.50',
            medianPosition: '2.00',
            minPosition: 1,
            maxPosition: 5,
            firstMentionCount: 20,
            firstMentionRate: '40.00',
            topThreeCount: 35,
            topThreeRate: '70.00',
            positionDistribution: {},
            modelRunCount: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('positions', 'ws_1', {
        promptSetId: 'ps_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brandId: 'brand_1',
        averagePosition: '2.50',
        medianPosition: '2.00',
        firstMentionRate: '40.00',
        topThreeRate: '70.00',
      });
    });
  });

  describe('opportunities fetcher', () => {
    it('returns correct row shape', async () => {
      mockGetOpportunities.mockResolvedValueOnce({
        items: [
          {
            id: 'opp_1',
            workspaceId: 'ws_1',
            brandId: 'brand_1',
            promptSetId: 'ps_1',
            promptId: 'p_1',
            promptText: 'best CRM software',
            periodStart: '2026-03-01',
            type: 'missing',
            score: '0.85',
            competitorCount: 3,
            totalTrackedBrands: 5,
            platformCount: 2,
            brandCitationCount: 0,
            competitors: [],
            platformBreakdown: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        summary: { totalOpportunities: 1, missingCount: 1, weakCount: 0, averageScore: '0.85' },
      });

      const { fetchExportData } = await import('./export.fetchers');
      const result = await fetchExportData('opportunities', 'ws_1', {
        promptSetId: 'ps_1',
        brandId: 'brand_1',
      });

      const rows = await collectRows(result.rows);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brandId: 'brand_1',
        promptText: 'best CRM software',
        type: 'missing',
        score: '0.85',
        competitorCount: 3,
        brandCitationCount: 0,
      });
    });
  });
});
