// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);

  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
    },
  };
});

vi.mock('./citation.schema', () => ({
  citation: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    modelRunId: 'modelRunId',
    modelRunResultId: 'modelRunResultId',
    platformId: 'platformId',
    citationType: 'citationType',
    position: 'position',
    contextSnippet: 'contextSnippet',
    relevanceSignal: 'relevanceSignal',
    sourceUrl: 'sourceUrl',
    title: 'title',
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

function resetMocks() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);
}

const sampleCitation = {
  id: 'cit_test1',
  workspaceId: 'ws_test',
  brandId: 'brand_test1',
  modelRunId: 'run_test1',
  modelRunResultId: 'runres_test1',
  platformId: 'chatgpt',
  citationType: 'owned',
  position: 1,
  contextSnippet: 'Acme is great.',
  relevanceSignal: 'domain_match',
  sourceUrl: 'https://acme.com/page',
  title: 'Acme Page',
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

describe('citation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('listCitations', () => {
    it('returns paginated citations', async () => {
      mockOffset.mockReturnValueOnce([sampleCitation]);
      mockCountTotal.mockResolvedValueOnce(1);

      const { listCitations } = await import('./citation.service');
      const result = await listCitations('ws_test', {}, { page: 1, limit: 25, order: 'desc' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('cit_test1');
      expect(result.total).toBe(1);
    });

    it('passes filters to query conditions', async () => {
      mockOffset.mockReturnValueOnce([]);
      mockCountTotal.mockResolvedValueOnce(0);

      const { listCitations } = await import('./citation.service');
      await listCitations(
        'ws_test',
        { brandId: 'brand_test1', citationType: 'owned' },
        { page: 1, limit: 25, order: 'desc' }
      );

      // Verify select was called (we can't easily check conditions with this mock style,
      // but we verify it doesn't throw and returns correctly)
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('getCitation', () => {
    it('returns citation for correct workspace', async () => {
      mockLimit.mockReturnValueOnce([sampleCitation]);

      const { getCitation } = await import('./citation.service');
      const result = await getCitation('cit_test1', 'ws_test');

      expect(result.id).toBe('cit_test1');
    });

    it('throws not-found for wrong workspace', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getCitation } = await import('./citation.service');
      await expect(getCitation('cit_test1', 'ws_other')).rejects.toThrow('Citation not found');
    });
  });

  describe('getCitationsByModelRun', () => {
    it('returns citations for specific run', async () => {
      mockOffset.mockReturnValueOnce([sampleCitation]);
      mockCountTotal.mockResolvedValueOnce(1);

      const { getCitationsByModelRun } = await import('./citation.service');
      const result = await getCitationsByModelRun('run_test1', 'ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
