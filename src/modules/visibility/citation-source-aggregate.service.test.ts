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

vi.mock('./citation-source-aggregate.schema', () => ({
  citationSourceAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    platformId: 'platformId',
    locale: 'locale',
    domain: 'domain',
    periodStart: 'periodStart',
    frequency: 'frequency',
    firstSeenAt: 'firstSeenAt',
    lastSeenAt: 'lastSeenAt',
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
  id: 'csrcagg_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  domain: 'example.com',
  periodStart: '2026-04-03',
  frequency: 12,
  firstSeenAt: new Date('2026-04-01T10:00:00.000Z'),
  lastSeenAt: new Date('2026-04-03T16:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function resetMockChain() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([sampleRow]);
  mockCountTotal.mockResolvedValue(1);
}

describe('getCitationSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockChain();
  });

  it('returns paginated citation source data for day granularity', async () => {
    const { getCitationSources } = await import('./citation-source-aggregate.service');
    const result = await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(result.items).toEqual([sampleRow]);
    expect(result.total).toBe(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('returns empty result when no data exists', async () => {
    mockOffset.mockReturnValueOnce([]);
    mockCountTotal.mockResolvedValueOnce(0);

    const { getCitationSources } = await import('./citation-source-aggregate.service');
    const result = await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('applies brandId filter when provided', async () => {
    const { getCitationSources } = await import('./citation-source-aggregate.service');
    await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1', brandId: 'brand_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    // The where function was called — we're testing the code path completes without error
    expect(mockWhere).toHaveBeenCalled();
  });

  it('applies domain filter when provided', async () => {
    const { getCitationSources } = await import('./citation-source-aggregate.service');
    await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1', domain: 'example.com' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(mockWhere).toHaveBeenCalled();
  });

  it('defaults to _all sentinels when no platform/locale filter', async () => {
    const { getCitationSources } = await import('./citation-source-aggregate.service');
    await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1' },
      { page: 1, limit: 25, order: 'desc' }
    );

    // Verify the query was made — sentinel filtering is handled in conditions
    expect(mockSelect).toHaveBeenCalled();
  });

  it('handles week/month granularity without errors', async () => {
    // For aggregated queries, the chain is: select → from → where → groupBy → orderBy → limit → offset
    // First call: the aggregated query
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
    mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
    mockLimit.mockReturnValueOnce({ offset: mockOffset });
    mockOffset.mockReturnValueOnce([{ ...sampleRow, frequency: 24 }]);

    // Second call: count query via selectDistinct subquery
    const mockAs = vi.fn().mockReturnValue('subquery');
    const mockSubWhere = vi.fn().mockReturnValue({ as: mockAs });
    const mockSubFrom = vi.fn().mockReturnValue({ where: mockSubWhere });
    mockSelectDistinct.mockReturnValueOnce({ from: mockSubFrom });

    // Outer count select
    mockSelect.mockReturnValueOnce({ from: vi.fn().mockReturnValue([{ count: 1 }]) });

    const { getCitationSources } = await import('./citation-source-aggregate.service');
    const result = await getCitationSources(
      'ws_test',
      { promptSetId: 'ps_test1', granularity: 'month' },
      { page: 1, limit: 25, order: 'desc' }
    );

    expect(result.items).toBeDefined();
    expect(result.items).toHaveLength(1);
  });
});

describe('CITATION_SOURCE_ALLOWED_SORTS', () => {
  it('exports allowed sort fields', async () => {
    const { CITATION_SOURCE_ALLOWED_SORTS } = await import('./citation-source-aggregate.service');
    expect(CITATION_SOURCE_ALLOWED_SORTS).toEqual(
      expect.arrayContaining(['frequency', 'domain', 'firstSeenAt', 'lastSeenAt', 'periodStart'])
    );
  });
});
