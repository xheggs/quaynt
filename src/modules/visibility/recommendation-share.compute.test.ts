// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock declarations (hoisted by vi.mock) ---
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockGroupBy = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflict = vi.fn();
const mockReturning = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
      insert: (...a: unknown[]) => mockInsert(...a),
    },
  };
});

vi.mock('./recommendation-share.schema', () => ({
  recommendationShare: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    brandId: 'brandId',
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

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    brandId: 'brandId',
    platformId: 'platformId',
    locale: 'locale',
    modelRunId: 'modelRunId',
  },
}));

vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    status: 'status',
    startedAt: 'startedAt',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const WS = 'ws_test';
const PS = 'ps_test1';
const DATE = '2026-04-03';

function resetMocks() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ groupBy: mockGroupBy });
  mockGroupBy.mockReturnValue([]);

  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
  mockOnConflict.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
}

// --- Pure function tests ---

describe('expandAggregates', () => {
  it('computes correct share for 2 brands (60/40 split)', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 6,
        modelRunCount: 2,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 4,
        modelRunCount: 2,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    expect(rows).toHaveLength(8); // 2 brands × 4 levels

    const brandAOverall = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(brandAOverall!.sharePercentage).toBe('60.00');
    expect(brandAOverall!.citationCount).toBe(6);
    expect(brandAOverall!.totalCitations).toBe(10);

    const brandBOverall = rows.find(
      (r) => r.brandId === 'brand_b' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(brandBOverall!.sharePercentage).toBe('40.00');
    expect(brandBOverall!.citationCount).toBe(4);
    expect(brandBOverall!.totalCitations).toBe(10);
  });

  it('computes correct multi-level aggregates across platforms', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 3,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_a',
        platformId: 'perplexity',
        locale: 'en',
        citationCount: 2,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 5,
        modelRunCount: 1,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    // Brand A, chatgpt, en — 3/8 = 37.5%
    const aChatgptEn = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === 'chatgpt' && r.locale === 'en'
    );
    expect(aChatgptEn!.sharePercentage).toBe('37.50');
    expect(aChatgptEn!.totalCitations).toBe(8);

    // Brand A, perplexity, en — 2/2 = 100%
    const aPerplexityEn = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === 'perplexity' && r.locale === 'en'
    );
    expect(aPerplexityEn!.sharePercentage).toBe('100.00');

    // Brand A, _all, _all — 5/10 = 50%
    const aOverall = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(aOverall!.sharePercentage).toBe('50.00');
    expect(aOverall!.citationCount).toBe(5);
    expect(aOverall!.totalCitations).toBe(10);

    // Brand A, chatgpt, _all — 3/8 = 37.5%
    const aChatgptAll = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === 'chatgpt' && r.locale === '_all'
    );
    expect(aChatgptAll!.sharePercentage).toBe('37.50');
  });

  it('handles single brand in market (100% share)', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_only',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 7,
        modelRunCount: 3,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.sharePercentage).toBe('100.00');
      expect(row.citationCount).toBe(7);
      expect(row.totalCitations).toBe(7);
    }
  });

  it('returns empty rows when no aggregates', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const rows = expandAggregates([], WS, PS, DATE);
    expect(rows).toHaveLength(0);
  });

  it('handles multiple locales correctly', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 4,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'de',
        citationCount: 2,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 6,
        modelRunCount: 1,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    // Brand A, _all, en — 4/10 = 40%
    const aAllEn = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === 'en'
    );
    expect(aAllEn!.sharePercentage).toBe('40.00');
    expect(aAllEn!.totalCitations).toBe(10);

    // Brand A, _all, de — 2/2 = 100%
    const aAllDe = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === 'de'
    );
    expect(aAllDe!.sharePercentage).toBe('100.00');

    // Brand A, _all, _all — 6/12 = 50%
    const aOverall = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(aOverall!.sharePercentage).toBe('50.00');
    expect(aOverall!.citationCount).toBe(6);
    expect(aOverall!.totalCitations).toBe(12);
  });

  it('tracks model run counts correctly at each level', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 3,
        modelRunCount: 2,
      },
      {
        brandId: 'brand_a',
        platformId: 'perplexity',
        locale: 'en',
        citationCount: 1,
        modelRunCount: 1,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    const chatgpt = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === 'chatgpt' && r.locale === 'en'
    );
    expect(chatgpt!.modelRunCount).toBe(2);

    const overall = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(overall!.modelRunCount).toBe(3);
  });

  it('shares sum to 100% across brands for each aggregation level', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 3,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 5,
        modelRunCount: 1,
      },
      {
        brandId: 'brand_c',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 2,
        modelRunCount: 1,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);

    const overallRows = rows.filter((r) => r.platformId === '_all' && r.locale === '_all');
    const totalShare = overallRows.reduce((sum, r) => sum + parseFloat(r.sharePercentage), 0);
    expect(totalShare).toBeCloseTo(100, 1);

    const chatgptEnRows = rows.filter((r) => r.platformId === 'chatgpt' && r.locale === 'en');
    const chatgptEnShare = chatgptEnRows.reduce((sum, r) => sum + parseFloat(r.sharePercentage), 0);
    expect(chatgptEnShare).toBeCloseTo(100, 1);
  });

  it('sets correct workspaceId, promptSetId, and periodStart on all rows', async () => {
    const { expandAggregates } = await import('./recommendation-share.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 5,
        modelRunCount: 1,
      },
    ];

    const rows = expandAggregates(aggregates, WS, PS, DATE);
    for (const row of rows) {
      expect(row.workspaceId).toBe(WS);
      expect(row.promptSetId).toBe(PS);
      expect(row.periodStart).toBe(DATE);
    }
  });
});

// --- DB-dependent tests ---

describe('computeRecommendationShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns changed: false when no citations exist for the day', async () => {
    mockGroupBy.mockReturnValueOnce([]);

    const { computeRecommendationShare } = await import('./recommendation-share.compute');
    const result = await computeRecommendationShare({
      workspaceId: WS,
      promptSetId: PS,
      date: DATE,
    });

    expect(result.changed).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('upserts rows and returns changed: true when citations exist', async () => {
    mockGroupBy.mockReturnValueOnce([
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 6,
        modelRunCount: 2,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        citationCount: 4,
        modelRunCount: 2,
      },
    ]);

    mockReturning.mockReturnValueOnce([
      { id: 'recshare_1', sharePercentage: '60.00', createdAt: new Date(), updatedAt: new Date() },
      { id: 'recshare_2', sharePercentage: '40.00', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { computeRecommendationShare } = await import('./recommendation-share.compute');
    const result = await computeRecommendationShare({
      workspaceId: WS,
      promptSetId: PS,
      date: DATE,
    });

    expect(result.changed).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          brandId: 'brand_a',
          sharePercentage: '60.00',
        }),
      ])
    );
  });
});
