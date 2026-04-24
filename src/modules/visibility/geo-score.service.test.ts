// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { runScoringEngine } from './geo-score.service';
import type { GeoScoreInputs } from './geo-score.types';

function baseInputs(overrides: Partial<GeoScoreInputs> = {}): GeoScoreInputs {
  return {
    workspaceId: 'ws_1',
    brandId: 'brand_1',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    granularity: 'monthly',
    contributingPromptSetIds: ['ps_1'],
    factors: {
      citation_frequency: { sharePercentage: 25, totalCitations: 100 },
      source_diversity: { domainCount: 15 },
      sentiment_balance: { netSentimentScore: 0.4, totalCitations: 100 },
      position_stability: {
        firstMentionRate: 0.4,
        cv: 0.1,
        window: { granularity: 'monthly', periodsUsed: 3 },
      },
      accuracy: null,
      coverage_breadth: { observedPairs: 5, expectedPairs: 10, expectedSource: 'promptSetConfig' },
    },
    ...overrides,
  };
}

describe('runScoringEngine', () => {
  it('produces a complete result shape', () => {
    const result = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_1',
      brandId: 'brand_1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });

    expect(result.composite).not.toBeNull();
    expect(result.compositeRaw).not.toBeNull();
    // accuracy is notYetScored — cap only applies when compositeRaw > 95
    expect(result.factors).toHaveLength(6);
    expect(result.factors.find((f) => f.id === 'accuracy')?.status).toBe('notYetScored');
    expect(result.formulaVersion).toBe(1);
    expect(result.recommendations).toBeDefined();
  });

  it('returns NO_ENABLED_PROMPT_SETS when no prompt sets contribute', () => {
    const result = runScoringEngine({
      inputs: baseInputs({ contributingPromptSetIds: [] }),
      workspaceId: 'ws_1',
      brandId: 'brand_1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });

    expect(result.composite).toBeNull();
    expect(result.code).toBe('NO_ENABLED_PROMPT_SETS');
    expect(result.recommendations).toEqual([]);
  });

  it('returns INSUFFICIENT_FACTORS when fewer than 3 factors are active', () => {
    const inputs = baseInputs({
      factors: {
        citation_frequency: { sharePercentage: 25, totalCitations: 100 },
        source_diversity: { domainCount: 5 },
        sentiment_balance: null,
        position_stability: null,
        accuracy: null,
        coverage_breadth: null,
      },
    });
    const result = runScoringEngine({
      inputs,
      workspaceId: 'ws_1',
      brandId: 'brand_1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.composite).toBeNull();
    expect(result.code).toBe('INSUFFICIENT_FACTORS');
  });

  it('is deterministic — same inputs produce same composite', () => {
    const a = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_1',
      brandId: 'brand_1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    const b = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_1',
      brandId: 'brand_1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(a.composite).toBe(b.composite);
    expect(a.compositeRaw).toBe(b.compositeRaw);
    expect(a.factors.map((f) => f.score)).toEqual(b.factors.map((f) => f.score));
  });
});
