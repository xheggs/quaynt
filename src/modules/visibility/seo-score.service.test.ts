// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { runScoringEngine } from './seo-score.service';
import type { SeoScoreInputs } from './seo-score.types';

function baseInputs(): SeoScoreInputs {
  return {
    workspaceId: 'ws_a',
    brandId: 'brand_a',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    granularity: 'monthly',
    contributingPromptSetIds: ['ps_a'],
    querySetSize: 10,
    factors: {
      impression_volume: { impressions: 25_000, querySetSize: 10 },
      click_through_rate: {
        impressionWeightedCtr: 0.15,
        totalImpressions: 25_000,
      },
      rank_quality: {
        impressionWeightedPosition: 5.5,
        totalImpressions: 25_000,
      },
      aio_presence: { aioMatchedCount: 7, querySetSize: 10 },
    },
  };
}

describe('runScoringEngine', () => {
  it('produces a composite from full inputs', () => {
    const result = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.composite).not.toBeNull();
    expect(result.factors).toHaveLength(4);
    expect(result.formulaVersion).toBe(1);
    expect(result.contributingPromptSetIds).toEqual(['ps_a']);
    expect(result.querySetSize).toBe(10);
  });

  it('returns NO_GSC_CONNECTION code with all factors insufficientData', () => {
    const inputs: SeoScoreInputs = {
      ...baseInputs(),
      contributingPromptSetIds: [],
      querySetSize: 0,
      factors: {
        impression_volume: null,
        click_through_rate: null,
        rank_quality: null,
        aio_presence: null,
      },
      code: 'NO_GSC_CONNECTION',
    };
    const result = runScoringEngine({
      inputs,
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.composite).toBeNull();
    expect(result.code).toBe('NO_GSC_CONNECTION');
    expect(result.factors.every((f) => f.status === 'insufficientData')).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it('surfaces GSC impression-bug advisory for a period inside the window', () => {
    const result = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2025-09-01',
      periodEnd: '2025-09-30',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.dataQualityAdvisories).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });

  it('emits no advisory for a period outside the bug window', () => {
    const result = runScoringEngine({
      inputs: baseInputs(),
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.dataQualityAdvisories).toEqual([]);
  });

  it('AIO Presence is active with score 0 when querySet>0 and matches=0', () => {
    const inputs: SeoScoreInputs = {
      ...baseInputs(),
      factors: {
        ...baseInputs().factors,
        aio_presence: { aioMatchedCount: 0, querySetSize: 10 },
      },
    };
    const result = runScoringEngine({
      inputs,
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    const aio = result.factors.find((f) => f.id === 'aio_presence');
    expect(aio?.score).toBe(0);
    expect(aio?.status).toBe('active');
  });

  it('emits empty recommendations when composite is null', () => {
    const inputs: SeoScoreInputs = {
      ...baseInputs(),
      factors: {
        impression_volume: null,
        click_through_rate: null,
        rank_quality: null,
        aio_presence: { aioMatchedCount: 5, querySetSize: 10 },
      },
    };
    const result = runScoringEngine({
      inputs,
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      granularity: 'monthly',
      platformId: '_all',
      locale: '_all',
    });
    expect(result.composite).toBeNull();
    expect(result.code).toBe('INSUFFICIENT_FACTORS');
    expect(result.recommendations).toEqual([]);
  });
});
