// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockSelectDistinct = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
  },
}));

vi.mock('./sentiment-aggregate.schema', () => ({
  sentimentAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    periodStart: 'periodStart',
    positiveCount: 'positiveCount',
    neutralCount: 'neutralCount',
    negativeCount: 'negativeCount',
    totalCount: 'totalCount',
    positivePercentage: 'positivePercentage',
    neutralPercentage: 'neutralPercentage',
    negativePercentage: 'negativePercentage',
    netSentimentScore: 'netSentimentScore',
    averageScore: 'averageScore',
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
  id: 'sentagg_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  positiveCount: 3,
  neutralCount: 1,
  negativeCount: 1,
  totalCount: 5,
  positivePercentage: '60.00',
  neutralPercentage: '20.00',
  negativePercentage: '20.00',
  netSentimentScore: '40.00',
  averageScore: '0.1000',
  modelRunCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupDailyChain(items: object[] = [], total = 0) {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockResolvedValue(items);
  mockCountTotal.mockResolvedValue(total);
}

describe('getSentimentAggregates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filtered data by promptSetId', async () => {
    setupDailyChain([sampleRow], 1);

    const { getSentimentAggregates } = await import('./sentiment-aggregate.service');
    const result = await getSentimentAggregates(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(result.items).toEqual([sampleRow]);
    expect(result.total).toBe(1);
  });

  it('returns empty result when no data exists', async () => {
    setupDailyChain([], 0);

    const { getSentimentAggregates } = await import('./sentiment-aggregate.service');
    const result = await getSentimentAggregates(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('queries db with correct pagination', async () => {
    setupDailyChain([sampleRow], 1);

    const { getSentimentAggregates } = await import('./sentiment-aggregate.service');
    await getSentimentAggregates(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 2, limit: 10, order: 'desc' }
    );

    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(mockOffset).toHaveBeenCalledWith(10); // (page-1) * limit
  });
});

describe('getLatestSentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no data exists', async () => {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

    const { getLatestSentiment } = await import('./sentiment-aggregate.service');
    const result = await getLatestSentiment('ws_test', 'ps_test1');

    expect(result).toEqual([]);
  });

  it('returns most recent day data when rows exist', async () => {
    let callCount = 0;
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { orderBy: mockOrderBy };
      }
      return { orderBy: mockOrderBy };
    });
    mockOrderBy.mockImplementation(() => {
      if (callCount === 1) {
        return { limit: mockLimit };
      }
      return [sampleRow];
    });
    mockLimit.mockResolvedValue([{ periodStart: '2026-04-03' }]);

    const { getLatestSentiment } = await import('./sentiment-aggregate.service');
    const result = await getLatestSentiment('ws_test', 'ps_test1');

    expect(result).toEqual([sampleRow]);
  });
});
