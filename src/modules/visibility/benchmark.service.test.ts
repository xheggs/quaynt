// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the entire service's internal DB calls by mocking the db module
// and tracking calls to db.select() to return appropriate data per query.

const queryResults: unknown[][] = [];
let queryIndex = 0;

function createChain(): Record<string, unknown> {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ['from', 'innerJoin', 'where', 'groupBy', 'orderBy', 'limit', 'offset'];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  // Make the chain thenable so await resolves to the next result
  (chain as Record<string, unknown>).then = (resolve?: (v: unknown) => unknown) => {
    const result = queryResults[queryIndex] ?? [];
    queryIndex++;
    resolve?.(result);
    return chain;
  };
  return chain;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => createChain()),
  },
}));

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

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    platformId: 'platformId',
    locale: 'locale',
    modelRunId: 'modelRunId',
    modelRunResultId: 'modelRunResultId',
  },
  citationType: {},
}));

vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    status: 'status',
    startedAt: 'startedAt',
    createdAt: 'createdAt',
  },
  modelRunResult: {
    id: 'id',
    modelRunId: 'modelRunId',
    promptId: 'promptId',
    platformId: 'platformId',
  },
  modelRunStatus: {},
  modelRunResultStatus: {},
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', workspaceId: 'workspaceId', name: 'name', slug: 'slug' },
}));

vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', workspaceId: 'workspaceId', name: 'name' },
}));

vi.mock('@/modules/prompt-sets/prompt.schema', () => ({
  prompt: { id: 'id', promptSetId: 'promptSetId', template: 'template', order: 'order' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const WS = 'ws_test';
const PS = 'ps_market1';

/**
 * Queue up results for sequential db.select() calls.
 *
 * getBenchmarks makes these queries in order:
 * 1. Current period share aggregate (via Promise.all)
 * 2. Comparison period share aggregate (via Promise.all)
 * 3. PromptSet name (via Promise.all)
 * 4. Platform breakdown (only when no platformId filter AND brands.length > 0)
 * 5. Prompt count
 * 6. Last updated timestamp
 */
function queueResults(...results: unknown[][]) {
  queryResults.length = 0;
  queryIndex = 0;
  queryResults.push(...results);
}

describe('getBenchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.length = 0;
    queryIndex = 0;
  });

  it('returns all brands ranked by share descending', async () => {
    queueResults(
      // 1. Current period
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 6,
          totalCitations: 10,
          sharePercentage: '60.00',
          modelRunCount: 2,
        },
        {
          brandId: 'b2',
          brandName: 'Beta',
          citationCount: 4,
          totalCitations: 10,
          sharePercentage: '40.00',
          modelRunCount: 2,
        },
      ],
      // 2. Comparison period
      [],
      // 3. PromptSet name
      [{ name: 'Test Market' }],
      // 4. Platform breakdown (brands > 0, no platformId filter)
      [],
      // 5. Prompt count
      [{ count: 10 }],
      // 6. Last updated
      [{ updatedAt: new Date('2026-04-03T00:00:00Z') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands).toHaveLength(2);
    expect(result.brands[0].rank).toBe(1);
    expect(result.brands[0].brandId).toBe('b1');
    expect(result.brands[0].recommendationShare.current).toBe('60.00');
    expect(result.brands[1].rank).toBe(2);
    expect(result.brands[1].brandId).toBe('b2');
    expect(result.brands[1].recommendationShare.current).toBe('40.00');
  });

  it('computes correct deltas (current vs previous period)', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 7,
          totalCitations: 10,
          sharePercentage: '70.00',
          modelRunCount: 3,
        },
        {
          brandId: 'b2',
          brandName: 'Beta',
          citationCount: 3,
          totalCitations: 10,
          sharePercentage: '30.00',
          modelRunCount: 3,
        },
      ],
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
        {
          brandId: 'b2',
          brandName: 'Beta',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
      ],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].recommendationShare.delta).toBe('20.00');
    expect(result.brands[0].recommendationShare.direction).toBe('up');
    expect(result.brands[1].recommendationShare.delta).toBe('-20.00');
    expect(result.brands[1].recommendationShare.direction).toBe('down');
  });

  it('rankChange is positive when brand improved, negative when declined', async () => {
    queueResults(
      // Current: b1 is #1, b2 is #2
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 8,
          totalCitations: 10,
          sharePercentage: '80.00',
          modelRunCount: 2,
        },
        {
          brandId: 'b2',
          brandName: 'Beta',
          citationCount: 2,
          totalCitations: 10,
          sharePercentage: '20.00',
          modelRunCount: 2,
        },
      ],
      // Comparison: b2 was #1, b1 was #2
      [
        {
          brandId: 'b2',
          brandName: 'Beta',
          citationCount: 6,
          totalCitations: 10,
          sharePercentage: '60.00',
          modelRunCount: 2,
        },
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 4,
          totalCitations: 10,
          sharePercentage: '40.00',
          modelRunCount: 2,
        },
      ],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    // b1: was rank 2, now rank 1 → rankChange = 2 - 1 = +1
    expect(result.brands[0].brandId).toBe('b1');
    expect(result.brands[0].rankChange).toBe(1);
    // b2: was rank 1, now rank 2 → rankChange = 1 - 2 = -1
    expect(result.brands[1].brandId).toBe('b2');
    expect(result.brands[1].rankChange).toBe(-1);
  });

  it('rankChange is null when no comparison data exists (new entrant)', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'NewBrand',
          citationCount: 5,
          totalCitations: 5,
          sharePercentage: '100.00',
          modelRunCount: 1,
        },
      ],
      [],
      [{ name: 'Market' }],
      [],
      [{ count: 5 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].rankChange).toBeNull();
    expect(result.brands[0].recommendationShare.previous).toBeNull();
    expect(result.brands[0].recommendationShare.delta).toBeNull();
    expect(result.brands[0].recommendationShare.direction).toBeNull();
  });

  it('returns empty brands array when no data exists', async () => {
    queueResults(
      [],
      [],
      [{ name: 'Market' }],
      // No platform breakdown query because brands.length === 0
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands).toEqual([]);
    expect(result.meta.totalBrands).toBe(0);
  });

  it('stable direction when delta is zero', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
      ],
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
      ],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].recommendationShare.delta).toBe('0.00');
    expect(result.brands[0].recommendationShare.direction).toBe('stable');
  });

  it('citation count delta is computed correctly', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 10,
          totalCitations: 20,
          sharePercentage: '50.00',
          modelRunCount: 3,
        },
      ],
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 7,
          totalCitations: 14,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
      ],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].citationCount.current).toBe(10);
    expect(result.brands[0].citationCount.previous).toBe(7);
    expect(result.brands[0].citationCount.delta).toBe(3);
  });

  it('brand names are included from brand table join', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme Corp International',
          citationCount: 5,
          totalCitations: 5,
          sharePercentage: '100.00',
          modelRunCount: 1,
        },
      ],
      [],
      [{ name: 'Market' }],
      [],
      [{ count: 5 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].brandName).toBe('Acme Corp International');
  });

  it('modelRunCount is included', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 7,
        },
      ],
      [],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].modelRunCount).toBe(7);
  });

  it('includes market metadata', async () => {
    queueResults(
      [],
      [],
      [{ name: 'US Hotels Market' }],
      [{ count: 25 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.market.promptSetId).toBe(PS);
    expect(result.market.name).toBe('US Hotels Market');
    expect(result.meta.totalPrompts).toBe(25);
  });

  it('returns period information including comparison dates', async () => {
    queueResults([], [], [{ name: 'Market' }], [{ count: 0 }], []);

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.period.from).toBe('2026-03-27');
    expect(result.period.to).toBe('2026-04-03');
    expect(result.period.comparisonFrom).toBeDefined();
    expect(result.period.comparisonTo).toBeDefined();
  });

  it('includes platform breakdown when no platformId filter', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 10,
          totalCitations: 20,
          sharePercentage: '50.00',
          modelRunCount: 3,
        },
      ],
      [],
      [{ name: 'Market' }],
      // Platform breakdown
      [
        {
          brandId: 'b1',
          platformId: 'chatgpt',
          citationCount: 6,
          totalCitations: 12,
          sharePercentage: '50.00',
        },
        {
          brandId: 'b1',
          platformId: 'perplexity',
          citationCount: 4,
          totalCitations: 8,
          sharePercentage: '50.00',
        },
      ],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].platformBreakdown).toHaveLength(2);
    expect(result.brands[0].platformBreakdown![0].platformId).toBe('chatgpt');
    expect(result.brands[0].platformBreakdown![1].platformId).toBe('perplexity');
  });

  it('omits platform breakdown when platformId is filtered', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'Acme',
          citationCount: 6,
          totalCitations: 12,
          sharePercentage: '50.00',
          modelRunCount: 2,
        },
      ],
      [],
      [{ name: 'Market' }],
      // No platform breakdown query when platformId is filtered
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      platformId: 'chatgpt',
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.brands[0].platformBreakdown).toBeUndefined();
  });

  it('shares across brands in response reflect the computed percentages', async () => {
    queueResults(
      [
        {
          brandId: 'b1',
          brandName: 'A',
          citationCount: 3,
          totalCitations: 10,
          sharePercentage: '30.00',
          modelRunCount: 1,
        },
        {
          brandId: 'b2',
          brandName: 'B',
          citationCount: 5,
          totalCitations: 10,
          sharePercentage: '50.00',
          modelRunCount: 1,
        },
        {
          brandId: 'b3',
          brandName: 'C',
          citationCount: 2,
          totalCitations: 10,
          sharePercentage: '20.00',
          modelRunCount: 1,
        },
      ],
      [],
      [{ name: 'Market' }],
      [],
      [{ count: 10 }],
      [{ updatedAt: new Date('2026-04-03') }]
    );

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    const totalShare = result.brands.reduce(
      (sum, b) => sum + parseFloat(b.recommendationShare.current),
      0
    );
    expect(totalShare).toBeCloseTo(100, 1);
  });

  it('lastUpdatedAt is null when no recommendation share data exists', async () => {
    queueResults([], [], [{ name: 'Market' }], [{ count: 0 }], []);

    const { getBenchmarks } = await import('./benchmark.service');
    const result = await getBenchmarks(WS, {
      promptSetId: PS,
      from: '2026-03-27',
      to: '2026-04-03',
    });

    expect(result.meta.lastUpdatedAt).toBeNull();
  });
});

describe('getPresenceMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.length = 0;
    queryIndex = 0;
  });

  it('returns correct prompt/brand presence grid', async () => {
    queueResults([
      {
        promptId: 'p1',
        promptText: 'Best hotel?',
        brandId: 'b1',
        brandName: 'Hilton',
        citationCount: 5,
      },
      {
        promptId: 'p1',
        promptText: 'Best hotel?',
        brandId: 'b2',
        brandName: 'Marriott',
        citationCount: 3,
      },
      {
        promptId: 'p2',
        promptText: 'Cheap hotel?',
        brandId: 'b1',
        brandName: 'Hilton',
        citationCount: 2,
      },
    ]);

    const { getPresenceMatrix } = await import('./benchmark.service');
    const result = await getPresenceMatrix(WS, { promptSetId: PS }, { page: 1, limit: 25 });

    expect(result.rows).toHaveLength(2);
    // p1 has 8 total citations, p2 has 2 — p1 first
    expect(result.rows[0].promptId).toBe('p1');
    expect(result.rows[0].brands).toHaveLength(2);
    expect(result.rows[0].brands[0].present).toBe(true);
    expect(result.rows[0].brands[0].citationCount).toBe(5);
    expect(result.rows[1].promptId).toBe('p2');
    expect(result.rows[1].brands).toHaveLength(1);
  });

  it('returns empty rows when no citations exist', async () => {
    queueResults([]);

    const { getPresenceMatrix } = await import('./benchmark.service');
    const result = await getPresenceMatrix(WS, { promptSetId: PS }, { page: 1, limit: 25 });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('pagination works correctly', async () => {
    queueResults([
      { promptId: 'p1', promptText: 'Q1', brandId: 'b1', brandName: 'A', citationCount: 10 },
      { promptId: 'p2', promptText: 'Q2', brandId: 'b1', brandName: 'A', citationCount: 5 },
      { promptId: 'p3', promptText: 'Q3', brandId: 'b1', brandName: 'A', citationCount: 1 },
    ]);

    const { getPresenceMatrix } = await import('./benchmark.service');
    const result = await getPresenceMatrix(WS, { promptSetId: PS }, { page: 2, limit: 1 });

    expect(result.total).toBe(3);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].promptId).toBe('p2');
  });

  it('prompts are sorted by total citations descending', async () => {
    queueResults([
      { promptId: 'p1', promptText: 'Low', brandId: 'b1', brandName: 'A', citationCount: 1 },
      { promptId: 'p2', promptText: 'High', brandId: 'b1', brandName: 'A', citationCount: 10 },
      { promptId: 'p2', promptText: 'High', brandId: 'b2', brandName: 'B', citationCount: 5 },
    ]);

    const { getPresenceMatrix } = await import('./benchmark.service');
    const result = await getPresenceMatrix(WS, { promptSetId: PS }, { page: 1, limit: 25 });

    expect(result.rows[0].promptId).toBe('p2');
    expect(result.rows[1].promptId).toBe('p1');
  });

  it('includes promptText for each row', async () => {
    queueResults([
      {
        promptId: 'p1',
        promptText: 'What is the best CRM?',
        brandId: 'b1',
        brandName: 'Salesforce',
        citationCount: 3,
      },
    ]);

    const { getPresenceMatrix } = await import('./benchmark.service');
    const result = await getPresenceMatrix(WS, { promptSetId: PS }, { page: 1, limit: 25 });

    expect(result.rows[0].promptText).toBe('What is the best CRM?');
  });
});
