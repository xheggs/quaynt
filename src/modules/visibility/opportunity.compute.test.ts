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
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
      insert: (...a: unknown[]) => mockInsert(...a),
      delete: (...a: unknown[]) => mockDelete(...a),
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

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    id: 'id',
    brandId: 'brandId',
    platformId: 'platformId',
    modelRunId: 'modelRunId',
    modelRunResultId: 'modelRunResultId',
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
  modelRunResult: {
    id: 'id',
    promptId: 'promptId',
    modelRunId: 'modelRunId',
  },
}));

vi.mock('@/modules/prompt-sets/prompt.schema', () => ({
  prompt: {
    id: 'id',
    promptSetId: 'promptSetId',
    template: 'template',
  },
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: {
    id: 'id',
    name: 'name',
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

// --- Pure function tests ---

describe('computeOpportunityScore', () => {
  it('returns maximum score (80) for missing type with full competitor density and platform breadth', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    const score = computeOpportunityScore(10, 10, 3, 3, 'missing');
    expect(score).toBe(80);
  });

  it('applies 0.7x penalty for weak type', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    const score = computeOpportunityScore(10, 10, 3, 3, 'weak');
    expect(score).toBe(56); // (50 + 30) * 0.7 = 56
  });

  it('scales with competitor density', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    const low = computeOpportunityScore(1, 10, 3, 3, 'missing');
    const high = computeOpportunityScore(8, 10, 3, 3, 'missing');
    expect(high).toBeGreaterThan(low);
  });

  it('scales with platform breadth', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    const onePlatform = computeOpportunityScore(5, 10, 1, 3, 'missing');
    const allPlatforms = computeOpportunityScore(5, 10, 3, 3, 'missing');
    expect(allPlatforms).toBeGreaterThan(onePlatform);
  });

  it('returns 0 when no competitors and no platforms', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    const score = computeOpportunityScore(0, 0, 0, 0, 'missing');
    expect(score).toBe(0);
  });

  it('computes specific score for 4/10 competitors on 2/3 platforms (missing)', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    // (4/10 * 50 + 2/3 * 30) * 1.0 = (20 + 20) * 1.0 = 40
    const score = computeOpportunityScore(4, 10, 2, 3, 'missing');
    expect(score).toBe(40);
  });

  it('computes specific score for 4/10 competitors on 2/3 platforms (weak)', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    // (4/10 * 50 + 2/3 * 30) * 0.7 = (20 + 20) * 0.7 = 28
    const score = computeOpportunityScore(4, 10, 2, 3, 'weak');
    expect(score).toBe(28);
  });

  it('rounds to nearest integer', async () => {
    const { computeOpportunityScore } = await import('./opportunity.compute');
    // (3/10 * 50 + 1/3 * 30) * 1.0 = (15 + 10) * 1.0 = 25
    const score = computeOpportunityScore(3, 10, 1, 3, 'missing');
    expect(score).toBe(25);
  });
});

// --- DB-dependent tests ---

/**
 * Sets up the mock chain for computeOpportunities.
 *
 * The compute function makes multiple db queries:
 * 1. fetchPresenceData: select → from → innerJoin × 3 → where → groupBy
 * 2. fetchPromptIds:    select → from → where (returns array directly)
 *
 * We use a whereCallCount to differentiate: first .where() chains to groupBy,
 * second .where() returns the prompt IDs array.
 */
function setupComputeMocks(
  presenceData: object[],
  promptIds: { id: string }[],
  upsertedIds: { id: string }[] = []
) {
  let whereCallCount = 0;

  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
  mockInnerJoin.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
  mockGroupBy.mockReturnValue(presenceData);

  mockWhere.mockImplementation(() => {
    whereCallCount++;
    if (whereCallCount === 1) {
      // fetchPresenceData — chain to groupBy
      return { groupBy: mockGroupBy };
    }
    // fetchPromptIds — return array directly
    return promptIds;
  });

  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
  mockOnConflict.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue(upsertedIds);

  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockReturnValue(undefined);
}

describe('computeOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns changed: false and opportunityCount: 0 when no citations exist', async () => {
    setupComputeMocks([], []);

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(false);
    expect(result.opportunityCount).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns changed: false when no prompts exist in the prompt set', async () => {
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'b1',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [] // no prompts
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(false);
    expect(result.opportunityCount).toBe(0);
  });

  it('returns changed: false when fewer than 2 tracked brands', async () => {
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'b1',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(false);
    expect(result.opportunityCount).toBe(0);
  });

  it('detects missing opportunities when brand has 0 citations but competitors have citations', async () => {
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 3,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 4,
        },
        {
          promptId: 'p2',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }, { id: 'p2' }],
      [{ id: 'opp_1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(true);
    expect(result.opportunityCount).toBeGreaterThan(0);
    expect(mockInsert).toHaveBeenCalled();

    const upsertedRows = mockValues.mock.calls[0][0];
    const missingOpp = upsertedRows.find(
      (r: { brandId: string; promptId: string; type: string }) =>
        r.brandId === 'brand_a' && r.promptId === 'p2' && r.type === 'missing'
    );
    expect(missingOpp).toBeDefined();
    expect(missingOpp.brandCitationCount).toBe(0);
    expect(missingOpp.competitorCount).toBe(1);
    expect(missingOpp.competitors).toEqual([
      { brandId: 'brand_b', brandName: 'Brand B', citationCount: 5 },
    ]);
  });

  it('detects weak opportunities when brand citations are below median competitor count', async () => {
    // brand_a has 1 citation, competitors have 5 and 8 → median = 5, 1 < 5 → weak
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 1,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 5,
        },
        {
          promptId: 'p1',
          brandId: 'brand_c',
          brandName: 'Brand C',
          platformId: 'chatgpt',
          citationCount: 8,
        },
      ],
      [{ id: 'p1' }],
      [{ id: 'opp_1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(true);
    const upsertedRows = mockValues.mock.calls[0][0];
    const weakOpp = upsertedRows.find(
      (r: { brandId: string; type: string }) => r.brandId === 'brand_a' && r.type === 'weak'
    );
    expect(weakOpp).toBeDefined();
    expect(weakOpp.brandCitationCount).toBe(1);
  });

  it('does not create opportunity when brand citations are at or above median', async () => {
    // brand_a has 5, competitors have 3 and 5 → median = 3, 5 >= 3 → not weak
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 5,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 3,
        },
        {
          promptId: 'p1',
          brandId: 'brand_c',
          brandName: 'Brand C',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }],
      [{ id: 'opp_1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    // brand_a: 5, competitors [3,5] median=3, 5 >= 3 → not weak
    // brand_b: 3, competitors [5,5] median=5, 3 < 5 → weak
    // brand_c: 5, competitors [5,3] median=3, 5 >= 3 → not weak
    const upsertedRows = mockValues.mock.calls[0]?.[0] ?? [];
    const brandAOpp = upsertedRows.find((r: { brandId: string }) => r.brandId === 'brand_a');
    expect(brandAOpp).toBeUndefined();
  });

  it('handles single competitor edge case (median equals their count)', async () => {
    // brand_a has 2, brand_b has 5 → median of [5] = 5, 2 < 5 → weak
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 2,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }],
      [{ id: 'opp_1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.changed).toBe(true);
    const upsertedRows = mockValues.mock.calls[0][0];
    const weakOpp = upsertedRows.find(
      (r: { brandId: string; type: string }) => r.brandId === 'brand_a' && r.type === 'weak'
    );
    expect(weakOpp).toBeDefined();
  });

  it('handles all competitors with identical citation counts (not weak when equal)', async () => {
    // All brands have 5 → median = 5, 5 >= 5 → not weak for any
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 5,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 5,
        },
        {
          promptId: 'p1',
          brandId: 'brand_c',
          brandName: 'Brand C',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    const result = await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(result.opportunityCount).toBe(0);
  });

  it('cleans up stale opportunities via delete', async () => {
    // All equal — no opportunities, but delete still runs for cleanup
    setupComputeMocks(
      [
        {
          promptId: 'p1',
          brandId: 'brand_a',
          brandName: 'Brand A',
          platformId: 'chatgpt',
          citationCount: 5,
        },
        {
          promptId: 'p1',
          brandId: 'brand_b',
          brandName: 'Brand B',
          platformId: 'chatgpt',
          citationCount: 5,
        },
      ],
      [{ id: 'p1' }]
    );

    const { computeOpportunities } = await import('./opportunity.compute');
    await computeOpportunities({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      date: '2026-04-03',
    });

    expect(mockDelete).toHaveBeenCalled();
  });
});
