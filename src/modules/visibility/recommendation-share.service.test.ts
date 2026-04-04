// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockSelectDistinct = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockGroupBy = vi.fn();
vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
      selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
    },
  };
});

vi.mock('./recommendation-share.schema', () => ({
  recommendationShare: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    sharePercentage: 'sharePercentage',
    citationCount: 'citationCount',
    totalCitations: 'totalCitations',
    modelRunCount: 'modelRunCount',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

const mockCountTotal = vi.fn();
vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn(({ page, limit }: { page: number; limit: number }) => ({
    limit,
    offset: (page - 1) * limit,
  })),
  sortConfig: vi.fn(() => undefined),
  applyDateRange: vi.fn(),
  countTotal: (...args: unknown[]) => mockCountTotal(...args),
}));

const sampleRow = {
  id: 'recshare_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  sharePercentage: '60.00',
  citationCount: 6,
  totalCitations: 10,
  modelRunCount: 2,
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

function resetMocks() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit, groupBy: mockGroupBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);
  mockGroupBy.mockReturnValue({ orderBy: mockOrderBy });
}

describe('recommendation share service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('getRecommendationShare', () => {
    it('returns paginated recommendation share data', async () => {
      mockOffset.mockReturnValueOnce([sampleRow]);
      mockCountTotal.mockResolvedValueOnce(1);

      const { getRecommendationShare } = await import('./recommendation-share.service');
      const result = await getRecommendationShare(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('recshare_test1');
      expect(result.total).toBe(1);
    });

    it('applies promptSetId filter (required)', async () => {
      mockOffset.mockReturnValueOnce([]);
      mockCountTotal.mockResolvedValueOnce(0);

      const { getRecommendationShare } = await import('./recommendation-share.service');
      await getRecommendationShare(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(mockSelect).toHaveBeenCalled();
    });

    it('filters by brandId when provided', async () => {
      mockOffset.mockReturnValueOnce([sampleRow]);
      mockCountTotal.mockResolvedValueOnce(1);

      const { getRecommendationShare } = await import('./recommendation-share.service');
      await getRecommendationShare(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(mockSelect).toHaveBeenCalled();
    });

    it('returns empty result when no data exists', async () => {
      mockOffset.mockReturnValueOnce([]);
      mockCountTotal.mockResolvedValueOnce(0);

      const { getRecommendationShare } = await import('./recommendation-share.service');
      const result = await getRecommendationShare(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getLatestRecommendationShare', () => {
    it('returns most recent day for all brands', async () => {
      // First query: get latest date
      let whereCallCount = 0;
      mockWhere.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) {
          return { orderBy: () => ({ limit: () => [{ periodStart: '2026-04-03' }] }) };
        }
        return { orderBy: () => [sampleRow] };
      });

      const { getLatestRecommendationShare } = await import('./recommendation-share.service');
      const result = await getLatestRecommendationShare('ws_test', 'ps_test1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('recshare_test1');
    });

    it('returns empty array when no data exists', async () => {
      mockWhere.mockReturnValueOnce({
        orderBy: () => ({ limit: () => [] }),
      });

      const { getLatestRecommendationShare } = await import('./recommendation-share.service');
      const result = await getLatestRecommendationShare('ws_test', 'ps_test1');

      expect(result).toHaveLength(0);
    });

    it('filters by brandId when provided', async () => {
      let whereCallCount = 0;
      mockWhere.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) {
          return { orderBy: () => ({ limit: () => [{ periodStart: '2026-04-03' }] }) };
        }
        return { orderBy: () => [sampleRow] };
      });

      const { getLatestRecommendationShare } = await import('./recommendation-share.service');
      const result = await getLatestRecommendationShare('ws_test', 'ps_test1', 'brand_test1');

      expect(result).toHaveLength(1);
    });
  });
});
