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
    sentimentLabel: 'sentimentLabel',
    sentimentScore: 'sentimentScore',
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

vi.mock('./sentiment-aggregate.schema', () => ({
  sentimentAggregate: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    brandId: 'brandId',
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

import { expandSentimentAggregates } from './sentiment-aggregate.compute';

describe('expandSentimentAggregates', () => {
  const baseInput = {
    workspaceId: 'ws_test',
    promptSetId: 'ps_test',
    date: '2026-04-03',
  };

  it('computes correct distribution for brand with mixed sentiment', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 3,
        modelRunCount: 2,
        scoreSum: 0.6,
      },
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'neutral',
        citationCount: 1,
        modelRunCount: 1,
        scoreSum: 0.01,
      },
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 1,
        modelRunCount: 1,
        scoreSum: -0.3,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    // Find the (_all, _all) global row
    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    expect(global).toBeDefined();
    expect(global!.positiveCount).toBe(3);
    expect(global!.neutralCount).toBe(1);
    expect(global!.negativeCount).toBe(1);
    expect(global!.totalCount).toBe(5);
    expect(global!.positivePercentage).toBe('60.00');
    expect(global!.neutralPercentage).toBe('20.00');
    expect(global!.negativePercentage).toBe('20.00');
    expect(global!.netSentimentScore).toBe('40.00');
  });

  it('computes correct multi-level aggregates across platforms', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 2,
        modelRunCount: 1,
        scoreSum: 0.4,
      },
      {
        brandId: 'brand_1',
        platformId: 'perplexity',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 1,
        modelRunCount: 1,
        scoreSum: -0.2,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    // Should produce 4 levels per unique combination
    // Level 1: (chatgpt, en), (perplexity, en)
    // Level 2: (chatgpt, _all), (perplexity, _all)
    // Level 3: (_all, en)
    // Level 4: (_all, _all)
    expect(rows.length).toBe(6);

    const globalRow = rows.find((r) => r.platformId === '_all' && r.locale === '_all');
    expect(globalRow!.totalCount).toBe(3);
    expect(globalRow!.positiveCount).toBe(2);
    expect(globalRow!.negativeCount).toBe(1);
  });

  it('handles single-sentiment brand (all positive)', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 5,
        modelRunCount: 3,
        scoreSum: 1.5,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');

    expect(global!.positivePercentage).toBe('100.00');
    expect(global!.neutralPercentage).toBe('0.00');
    expect(global!.negativePercentage).toBe('0.00');
    expect(global!.netSentimentScore).toBe('100.00');
  });

  it('returns empty array when no aggregates provided', () => {
    const rows = expandSentimentAggregates(
      [],
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    expect(rows).toEqual([]);
  });

  it('computes NSS correctly: (positive - negative) / total * 100', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 7,
        modelRunCount: 2,
        scoreSum: 1.4,
      },
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 3,
        modelRunCount: 1,
        scoreSum: -0.6,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');

    // NSS = (7 - 3) / 10 * 100 = 40.00
    expect(global!.netSentimentScore).toBe('40.00');
  });

  it('computes averageScore as mean of raw scores', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 2,
        modelRunCount: 1,
        scoreSum: 0.6,
      },
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 1,
        modelRunCount: 1,
        scoreSum: -0.3,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    const global = rows.find((r) => r.platformId === '_all' && r.locale === '_all');

    // averageScore = (0.6 + (-0.3)) / 3 = 0.1000
    expect(global!.averageScore).toBe('0.1000');
  });

  it('is idempotent — re-running produces same result', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 3,
        modelRunCount: 2,
        scoreSum: 0.9,
      },
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 2,
        modelRunCount: 1,
        scoreSum: -0.4,
      },
    ];

    const first = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );
    const second = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    expect(first).toEqual(second);
  });

  it('handles multiple brands independently', () => {
    const aggregates = [
      {
        brandId: 'brand_1',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'positive',
        citationCount: 4,
        modelRunCount: 2,
        scoreSum: 0.8,
      },
      {
        brandId: 'brand_2',
        platformId: 'chatgpt',
        locale: 'en',
        sentimentLabel: 'negative',
        citationCount: 3,
        modelRunCount: 1,
        scoreSum: -0.6,
      },
    ];

    const rows = expandSentimentAggregates(
      aggregates,
      baseInput.workspaceId,
      baseInput.promptSetId,
      baseInput.date
    );

    const brand1Global = rows.find(
      (r) => r.brandId === 'brand_1' && r.platformId === '_all' && r.locale === '_all'
    );
    const brand2Global = rows.find(
      (r) => r.brandId === 'brand_2' && r.platformId === '_all' && r.locale === '_all'
    );

    expect(brand1Global!.positiveCount).toBe(4);
    expect(brand1Global!.netSentimentScore).toBe('100.00');
    expect(brand2Global!.negativeCount).toBe(3);
    expect(brand2Global!.netSentimentScore).toBe('-100.00');
  });
});
