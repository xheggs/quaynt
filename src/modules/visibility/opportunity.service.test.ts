// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
    },
  };
});

vi.mock('./opportunity.schema', () => ({
  opportunity: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    promptId: 'promptId',
    periodStart: 'periodStart',
    type: 'type',
    score: 'score',
    competitorCount: 'competitorCount',
    totalTrackedBrands: 'totalTrackedBrands',
    platformCount: 'platformCount',
    brandCitationCount: 'brandCitationCount',
    competitors: 'competitors',
    platformBreakdown: 'platformBreakdown',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/modules/prompt-sets/prompt.schema', () => ({
  prompt: {
    id: 'id',
    template: 'template',
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

const sampleOpportunity = {
  id: 'opp_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  promptId: 'prompt_test1',
  promptText: 'Best project management tools',
  periodStart: '2026-04-03',
  type: 'missing',
  score: '65.00',
  competitorCount: 3,
  totalTrackedBrands: 5,
  platformCount: 2,
  brandCitationCount: 0,
  competitors: [
    { brandId: 'brand_b', brandName: 'Brand B', citationCount: 5 },
    { brandId: 'brand_c', brandName: 'Brand C', citationCount: 3 },
    { brandId: 'brand_d', brandName: 'Brand D', citationCount: 2 },
  ],
  platformBreakdown: [
    { platformId: 'chatgpt', brandGapOnPlatform: true, competitorCount: 3 },
    { platformId: 'perplexity', brandGapOnPlatform: true, competitorCount: 2 },
  ],
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

const summaryResult = {
  totalOpportunities: 1,
  missingCount: 1,
  weakCount: 0,
  averageScore: '65.00',
};

/**
 * Sets up mocks for getOpportunities which runs 3 parallel queries:
 * 1. Items: select → from → leftJoin → where → orderBy → limit → offset → items[]
 * 2. countTotal (mocked separately via mockCountTotal)
 * 3. Summary: select → from → where → [summaryResult]
 */
function setupServiceMocks(items: object[], total: number, summary: object) {
  let whereCallCount = 0;

  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockLeftJoin.mockReturnValue({ where: mockWhere });

  mockWhere.mockImplementation(() => {
    whereCallCount++;
    if (whereCallCount === 1) {
      // Items query — chain continues
      return { orderBy: mockOrderBy };
    }
    // Summary query — return array directly
    return [summary];
  });

  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue(items);
  mockCountTotal.mockResolvedValue(total);
}

describe('opportunity service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOpportunities', () => {
    it('returns paginated opportunity data with summary', async () => {
      setupServiceMocks([sampleOpportunity], 1, summaryResult);

      const { getOpportunities } = await import('./opportunity.service');
      const result = await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1', from: '2026-04-01', to: '2026-04-03' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('opp_test1');
      expect(result.items[0].type).toBe('missing');
      expect(result.total).toBe(1);
      expect(result.summary.totalOpportunities).toBe(1);
    });

    it('returns empty result with zero summary when no opportunities', async () => {
      const emptySummary = {
        totalOpportunities: 0,
        missingCount: 0,
        weakCount: 0,
        averageScore: '0.00',
      };
      setupServiceMocks([], 0, emptySummary);

      const { getOpportunities } = await import('./opportunity.service');
      const result = await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1', from: '2026-04-01', to: '2026-04-03' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.summary.totalOpportunities).toBe(0);
      expect(result.summary.averageScore).toBe('0.00');
    });

    it('returns empty result when no latest date found (default date range)', async () => {
      // When no from/to, the service queries for the latest periodStart first.
      // The select → from → where path returns an orderBy/limit chain that returns [].
      mockSelect.mockReturnValue({ from: mockFrom });
      mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
      mockLeftJoin.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValueOnce({
        orderBy: () => ({
          limit: () => [],
        }),
      });

      const { getOpportunities } = await import('./opportunity.service');
      const result = await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.summary.totalOpportunities).toBe(0);
    });

    it('calls select with correct query structure', async () => {
      setupServiceMocks([sampleOpportunity], 1, summaryResult);

      const { getOpportunities } = await import('./opportunity.service');
      await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1', from: '2026-04-01', to: '2026-04-03' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
    });

    it('includes competitors JSONB in results', async () => {
      setupServiceMocks([sampleOpportunity], 1, summaryResult);

      const { getOpportunities } = await import('./opportunity.service');
      const result = await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1', from: '2026-04-01', to: '2026-04-03' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items[0].competitors).toEqual([
        { brandId: 'brand_b', brandName: 'Brand B', citationCount: 5 },
        { brandId: 'brand_c', brandName: 'Brand C', citationCount: 3 },
        { brandId: 'brand_d', brandName: 'Brand D', citationCount: 2 },
      ]);
    });

    it('includes promptText from joined prompt table', async () => {
      setupServiceMocks([sampleOpportunity], 1, summaryResult);

      const { getOpportunities } = await import('./opportunity.service');
      const result = await getOpportunities(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1', from: '2026-04-01', to: '2026-04-03' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items[0].promptText).toBe('Best project management tools');
    });

    it('exports OPPORTUNITY_ALLOWED_SORTS', async () => {
      const { OPPORTUNITY_ALLOWED_SORTS } = await import('./opportunity.service');
      expect(OPPORTUNITY_ALLOWED_SORTS).toContain('score');
      expect(OPPORTUNITY_ALLOWED_SORTS).toContain('competitorCount');
      expect(OPPORTUNITY_ALLOWED_SORTS).toContain('platformCount');
      expect(OPPORTUNITY_ALLOWED_SORTS).toContain('type');
      expect(OPPORTUNITY_ALLOWED_SORTS).toContain('periodStart');
    });
  });
});
