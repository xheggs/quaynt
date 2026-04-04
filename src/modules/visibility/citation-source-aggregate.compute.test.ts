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

vi.mock('./citation-source-aggregate.schema', () => ({
  citationSourceAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    brandId: 'brandId',
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

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    brandId: 'brandId',
    platformId: 'platformId',
    locale: 'locale',
    domain: 'domain',
    modelRunId: 'modelRunId',
    createdAt: 'createdAt',
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
const EARLY = new Date('2026-04-03T08:00:00.000Z');
const LATE = new Date('2026-04-03T16:00:00.000Z');

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

describe('expandSourceAggregates', () => {
  it('produces 4 aggregate levels per brand per domain', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 3,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    expect(rows).toHaveLength(4);

    const level1 = rows.find((r) => r.platformId === 'chatgpt' && r.locale === 'en');
    expect(level1!.frequency).toBe(3);
    expect(level1!.domain).toBe('example.com');

    const level2 = rows.find((r) => r.platformId === 'chatgpt' && r.locale === '_all');
    expect(level2!.frequency).toBe(3);

    const level3 = rows.find((r) => r.platformId === '_all' && r.locale === 'en');
    expect(level3!.frequency).toBe(3);

    const level4 = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    expect(level4!.frequency).toBe(3);
  });

  it('sums frequencies across platforms at aggregate level', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 3,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
      {
        brandId: 'brand_a',
        platformId: 'perplexity',
        locale: 'en',
        domain: 'example.com',
        frequency: 2,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    // _all, _all level should sum both platforms
    const overall = rows.find(
      (r) =>
        r.brandId === 'brand_a' &&
        r.platformId === '_all' &&
        r.locale === '_all' &&
        r.domain === 'example.com'
    );
    expect(overall!.frequency).toBe(5);

    // chatgpt-specific should be 3
    const chatgpt = rows.find(
      (r) => r.platformId === 'chatgpt' && r.locale === '_all' && r.domain === 'example.com'
    );
    expect(chatgpt!.frequency).toBe(3);
  });

  it('keeps different domains separate', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 3,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'other.com',
        frequency: 2,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    // 2 domains × 4 levels = 8 rows
    expect(rows).toHaveLength(8);

    const exampleOverall = rows.find(
      (r) => r.platformId === '_all' && r.locale === '_all' && r.domain === 'example.com'
    );
    expect(exampleOverall!.frequency).toBe(3);

    const otherOverall = rows.find(
      (r) => r.platformId === '_all' && r.locale === '_all' && r.domain === 'other.com'
    );
    expect(otherOverall!.frequency).toBe(2);
  });

  it('tracks firstSeenAt and lastSeenAt correctly', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const earlier = new Date('2026-04-03T06:00:00.000Z');
    const later = new Date('2026-04-03T20:00:00.000Z');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 2,
        firstSeenAt: earlier,
        lastSeenAt: LATE,
      },
      {
        brandId: 'brand_a',
        platformId: 'perplexity',
        locale: 'en',
        domain: 'example.com',
        frequency: 1,
        firstSeenAt: EARLY,
        lastSeenAt: later,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    const overall = rows.find(
      (r) => r.platformId === '_all' && r.locale === '_all' && r.domain === 'example.com'
    );
    // firstSeenAt should be the earliest across all platforms
    expect(overall!.firstSeenAt).toEqual(earlier);
    // lastSeenAt should be the latest across all platforms
    expect(overall!.lastSeenAt).toEqual(later);
  });

  it('keeps different brands separate', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 5,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
      {
        brandId: 'brand_b',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 3,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    // 2 brands × 1 domain × 4 levels = 8 rows
    expect(rows).toHaveLength(8);

    const aOverall = rows.find(
      (r) => r.brandId === 'brand_a' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(aOverall!.frequency).toBe(5);

    const bOverall = rows.find(
      (r) => r.brandId === 'brand_b' && r.platformId === '_all' && r.locale === '_all'
    );
    expect(bOverall!.frequency).toBe(3);
  });

  it('returns empty rows when no aggregates', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const rows = expandSourceAggregates([], WS, PS, DATE);
    expect(rows).toHaveLength(0);
  });

  it('sets correct workspaceId, promptSetId, and periodStart on all rows', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 1,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);
    for (const row of rows) {
      expect(row.workspaceId).toBe(WS);
      expect(row.promptSetId).toBe(PS);
      expect(row.periodStart).toBe(DATE);
    }
  });

  it('handles multiple locales correctly', async () => {
    const { expandSourceAggregates } = await import('./citation-source-aggregate.compute');
    const aggregates = [
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 4,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'de',
        domain: 'example.com',
        frequency: 2,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ];

    const rows = expandSourceAggregates(aggregates, WS, PS, DATE);

    // chatgpt, _all should sum both locales
    const chatgptAll = rows.find(
      (r) => r.platformId === 'chatgpt' && r.locale === '_all' && r.domain === 'example.com'
    );
    expect(chatgptAll!.frequency).toBe(6);

    // _all, en should be just en
    const allEn = rows.find(
      (r) => r.platformId === '_all' && r.locale === 'en' && r.domain === 'example.com'
    );
    expect(allEn!.frequency).toBe(4);
  });
});

// --- DB-dependent tests ---

describe('computeCitationSourceAggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns changed: false when no citations with domain exist for the day', async () => {
    mockGroupBy.mockReturnValueOnce([]);

    const { computeCitationSourceAggregate } = await import('./citation-source-aggregate.compute');
    const result = await computeCitationSourceAggregate({
      workspaceId: WS,
      promptSetId: PS,
      date: DATE,
    });

    expect(result.changed).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('upserts rows and returns changed: true when citations with domains exist', async () => {
    mockGroupBy.mockReturnValueOnce([
      {
        brandId: 'brand_a',
        platformId: 'chatgpt',
        locale: 'en',
        domain: 'example.com',
        frequency: 5,
        firstSeenAt: EARLY,
        lastSeenAt: LATE,
      },
    ]);

    mockReturning.mockReturnValueOnce([{ id: 'csrcagg_1' }]);

    const { computeCitationSourceAggregate } = await import('./citation-source-aggregate.compute');
    const result = await computeCitationSourceAggregate({
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
          domain: 'example.com',
          frequency: 5,
        }),
      ])
    );
  });
});
