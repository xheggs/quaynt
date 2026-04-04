// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    brandId: 'brandId',
    platformId: 'platformId',
    locale: 'locale',
    position: 'position',
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

vi.mock('./position-aggregate.schema', () => ({
  positionAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    brandId: 'brandId',
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
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { computePositionMetrics, expandPositionAggregates } from './position-aggregate.compute';

describe('computePositionMetrics', () => {
  it('computes correct metrics for positions [1, 2, 3]', () => {
    const metrics = computePositionMetrics([1, 2, 3]);

    expect(metrics.citationCount).toBe(3);
    expect(metrics.averagePosition).toBe('2.00');
    expect(metrics.medianPosition).toBe('2.00');
    expect(metrics.minPosition).toBe(1);
    expect(metrics.maxPosition).toBe(3);
    expect(metrics.firstMentionCount).toBe(1);
    expect(metrics.firstMentionRate).toBe('33.33');
    expect(metrics.topThreeCount).toBe(3);
    expect(metrics.topThreeRate).toBe('100.00');
  });

  it('computes correct metrics for skewed positions [1, 1, 1, 5]', () => {
    const metrics = computePositionMetrics([1, 1, 1, 5]);

    expect(metrics.citationCount).toBe(4);
    expect(metrics.averagePosition).toBe('2.00');
    expect(metrics.medianPosition).toBe('1.00');
    expect(metrics.minPosition).toBe(1);
    expect(metrics.maxPosition).toBe(5);
    expect(metrics.firstMentionCount).toBe(3);
    expect(metrics.firstMentionRate).toBe('75.00');
    expect(metrics.topThreeCount).toBe(3);
    expect(metrics.topThreeRate).toBe('75.00');
  });

  it('handles positions with no first mentions or top-three [4, 5, 6]', () => {
    const metrics = computePositionMetrics([4, 5, 6]);

    expect(metrics.firstMentionCount).toBe(0);
    expect(metrics.firstMentionRate).toBe('0.00');
    expect(metrics.topThreeCount).toBe(0);
    expect(metrics.topThreeRate).toBe('0.00');
    expect(metrics.averagePosition).toBe('5.00');
    expect(metrics.medianPosition).toBe('5.00');
  });

  it('handles single position [1]', () => {
    const metrics = computePositionMetrics([1]);

    expect(metrics.citationCount).toBe(1);
    expect(metrics.averagePosition).toBe('1.00');
    expect(metrics.medianPosition).toBe('1.00');
    expect(metrics.minPosition).toBe(1);
    expect(metrics.maxPosition).toBe(1);
    expect(metrics.firstMentionCount).toBe(1);
    expect(metrics.firstMentionRate).toBe('100.00');
    expect(metrics.topThreeCount).toBe(1);
    expect(metrics.topThreeRate).toBe('100.00');
  });

  it('handles large position values with outliers [1, 2, 15, 20]', () => {
    const metrics = computePositionMetrics([1, 2, 15, 20]);

    expect(metrics.citationCount).toBe(4);
    expect(metrics.averagePosition).toBe('9.50');
    // Median of [1, 2, 15, 20] = (2 + 15) / 2 = 8.50
    expect(metrics.medianPosition).toBe('8.50');
    expect(metrics.minPosition).toBe(1);
    expect(metrics.maxPosition).toBe(20);
    expect(metrics.firstMentionCount).toBe(1);
    expect(metrics.topThreeCount).toBe(2);
  });

  it('builds correct position distribution histogram', () => {
    const metrics = computePositionMetrics([1, 1, 3, 5]);

    expect(metrics.positionDistribution).toEqual({
      '1': 2,
      '3': 1,
      '5': 1,
    });
  });

  it('computes correct median for even-length arrays', () => {
    const metrics = computePositionMetrics([1, 3]);
    // Median of [1, 3] = (1 + 3) / 2 = 2.00
    expect(metrics.medianPosition).toBe('2.00');
  });

  it('computes correct median for odd-length arrays', () => {
    const metrics = computePositionMetrics([1, 3, 7]);
    expect(metrics.medianPosition).toBe('3.00');
  });
});

describe('expandPositionAggregates', () => {
  const baseInput = {
    workspaceId: 'ws_test',
    promptSetId: 'ps_test',
    date: '2026-04-03',
  };

  it('produces 4 aggregation levels for a single brand/platform/locale', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1, 2, 3],
        modelRunIds: ['run_1', 'run_2'],
      },
    ];

    const rows = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    // 4 levels: (chatgpt, en), (chatgpt, _all), (_all, en), (_all, _all)
    expect(rows.length).toBe(4);

    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    expect(global).toBeDefined();
    expect(global!.averagePosition).toBe('2.00');
    expect(global!.citationCount).toBe(3);
    expect(global!.modelRunCount).toBe(2);
  });

  it('correctly aggregates across platforms at rolled-up levels', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1, 1],
        modelRunIds: ['run_1'],
      },
      {
        brandId: 'brand_1',
        platformId: 'perplexity',
        locale: 'en',
        positions: [3, 5],
        modelRunIds: ['run_2'],
      },
    ];

    const rows = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    // Level 1: (chatgpt, en), (perplexity, en) = 2
    // Level 2: (chatgpt, _all), (perplexity, _all) = 2
    // Level 3: (_all, en) = 1
    // Level 4: (_all, _all) = 1
    expect(rows.length).toBe(6);

    // Global should have positions [1, 1, 3, 5]
    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    expect(global!.citationCount).toBe(4);
    expect(global!.averagePosition).toBe('2.50');
    // Median of [1, 1, 3, 5] = (1 + 3) / 2 = 2.00
    expect(global!.medianPosition).toBe('2.00');
    expect(global!.firstMentionCount).toBe(2);
    expect(global!.topThreeCount).toBe(3);
  });

  it('handles multiple brands independently', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1, 2],
        modelRunIds: ['run_1'],
      },
      {
        brandId: 'brand_2',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [4, 5],
        modelRunIds: ['run_1'],
      },
    ];

    const rows = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    // 4 levels per brand = 8
    expect(rows.length).toBe(8);

    const brand1Global = rows.find(
      (r) => r.brandId === 'brand_1' && r.platformId === '_all' && r.locale === '_all'
    );
    const brand2Global = rows.find(
      (r) => r.brandId === 'brand_2' && r.platformId === '_all' && r.locale === '_all'
    );

    expect(brand1Global!.averagePosition).toBe('1.50');
    expect(brand2Global!.averagePosition).toBe('4.50');
  });

  it('returns empty array when no groups provided', () => {
    const rows = expandPositionAggregates(
      [],
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    expect(rows).toEqual([]);
  });

  it('is idempotent — re-running produces same result', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1, 3, 5],
        modelRunIds: ['run_1', 'run_2'],
      },
    ];

    const first = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    const second = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    expect(first).toEqual(second);
  });

  it('deduplicates modelRunIds at rolled-up levels', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1],
        modelRunIds: ['run_1', 'run_2'],
      },
      {
        brandId: 'brand_1',
        platformId: 'perplexity',
        locale: 'en',
        positions: [2],
        modelRunIds: ['run_1', 'run_3'],
      },
    ];

    const rows = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    // run_1 appears in both groups but should be counted once
    expect(global!.modelRunCount).toBe(3); // run_1, run_2, run_3
  });

  it('sets correct position distribution at rolled-up level', () => {
    const groups = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        positions: [1, 1],
        modelRunIds: ['run_1'],
      },
      {
        brandId: 'brand_1',
        platformId: 'perplexity',
        locale: 'en',
        positions: [1, 3],
        modelRunIds: ['run_2'],
      },
    ];

    const rows = expandPositionAggregates(
      groups,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    // Combined positions: [1, 1, 1, 3]
    expect(global!.positionDistribution).toEqual({ '1': 3, '3': 1 });
  });
});
