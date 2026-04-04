// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockSelectDistinct = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
      selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
    },
  };
});

vi.mock('./position-aggregate.schema', () => ({
  positionAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    citationCount: 'citationCount',
    averagePosition: 'averagePosition',
    medianPosition: 'medianPosition',
    minPosition: 'minPosition',
    maxPosition: 'maxPosition',
    firstMentionCount: 'firstMentionCount',
    firstMentionRate: 'firstMentionRate',
    topThreeCount: 'topThreeCount',
    topThreeRate: 'topThreeRate',
    positionDistribution: 'positionDistribution',
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
  id: 'posagg_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  citationCount: 10,
  averagePosition: '2.35',
  medianPosition: '2.00',
  minPosition: 1,
  maxPosition: 5,
  firstMentionCount: 4,
  firstMentionRate: '40.00',
  topThreeCount: 8,
  topThreeRate: '80.00',
  positionDistribution: { '1': 4, '2': 2, '3': 2, '4': 1, '5': 1 },
  modelRunCount: 3,
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

const sampleSummary = {
  totalCitations: 10,
  overallAveragePosition: '2.35',
  overallFirstMentionRate: '40.00',
  overallTopThreeRate: '80.00',
  brandsTracked: 1,
};

/**
 * Sets up mocks for getPositionAggregates daily query:
 * 1. Items: select → from → where → orderBy → limit → offset → items[]
 * 2. countTotal (separate mock)
 * 3. Summary: select → from → where → [summary]
 */
function setupDailyMocks(items: object[], total: number, summary: object) {
  mockSelect.mockImplementation(() => {
    return { from: mockFrom };
  });

  mockFrom.mockImplementation(() => {
    return { where: mockWhere };
  });

  let whereCallCount = 0;
  mockWhere.mockImplementation(() => {
    whereCallCount++;
    // Items query (call 1) chains to orderBy
    // Summary query (call 2) returns array directly
    if (whereCallCount % 2 === 1) {
      return { orderBy: mockOrderBy };
    }
    return [summary];
  });

  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue(items);
  mockCountTotal.mockResolvedValue(total);
}

describe('position aggregate service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPositionAggregates', () => {
    it('returns paginated position data with summary', async () => {
      setupDailyMocks([sampleRow], 1, sampleSummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      const result = await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('posagg_test1');
      expect(result.total).toBe(1);
      expect(result.summary.totalCitations).toBe(10);
      expect(result.summary.overallAveragePosition).toBe('2.35');
    });

    it('returns empty result with zero summary when no data', async () => {
      const emptySummary = {
        totalCitations: 0,
        overallAveragePosition: '0.00',
        overallFirstMentionRate: '0.00',
        overallTopThreeRate: '0.00',
        brandsTracked: 0,
      };
      setupDailyMocks([], 0, emptySummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      const result = await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.summary.totalCitations).toBe(0);
      expect(result.summary.overallAveragePosition).toBe('0.00');
    });

    it('includes position distribution in results', async () => {
      setupDailyMocks([sampleRow], 1, sampleSummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      const result = await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.items[0].positionDistribution).toEqual({
        '1': 4,
        '2': 2,
        '3': 2,
        '4': 1,
        '5': 1,
      });
    });

    it('filters by brandId when provided', async () => {
      setupDailyMocks([sampleRow], 1, sampleSummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1', brandId: 'brand_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(mockSelect).toHaveBeenCalled();
    });

    it('calls select with correct query structure', async () => {
      setupDailyMocks([sampleRow], 1, sampleSummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
    });

    it('exports POSITION_AGGREGATE_ALLOWED_SORTS', async () => {
      const { POSITION_AGGREGATE_ALLOWED_SORTS } = await import('./position-aggregate.service');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('periodStart');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('averagePosition');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('medianPosition');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('firstMentionRate');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('topThreeRate');
      expect(POSITION_AGGREGATE_ALLOWED_SORTS).toContain('citationCount');
    });

    it('returns correct summary metrics', async () => {
      setupDailyMocks([sampleRow], 1, sampleSummary);

      const { getPositionAggregates } = await import('./position-aggregate.service');
      const result = await getPositionAggregates(
        'ws_test',
        { promptSetId: 'ps_test1' },
        { page: 1, limit: 25, order: 'desc' }
      );

      expect(result.summary.overallFirstMentionRate).toBe('40.00');
      expect(result.summary.overallTopThreeRate).toBe('80.00');
      expect(result.summary.brandsTracked).toBe(1);
    });
  });
});
