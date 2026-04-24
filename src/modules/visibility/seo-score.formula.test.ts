// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  scoreImpressionVolume,
  scoreCtr,
  scoreRankQuality,
  scoreAioPresence,
  rankQualityAt,
  composeScore,
  buildFactorResult,
  detectAdvisories,
  FACTOR_WEIGHTS,
  FORMULA_VERSION,
  IMPRESSION_VOLUME_CEILING,
  CTR_CEILING,
} from './seo-score.formula';
import type { SeoFactorResult } from './seo-score.types';

describe('scoreImpressionVolume', () => {
  it('returns 0 for zero impressions with a non-empty query set', () => {
    expect(scoreImpressionVolume({ impressions: 0, querySetSize: 5 })).toEqual({
      score: 0,
      status: 'active',
    });
  });

  it('hits 100 at the ceiling', () => {
    expect(
      scoreImpressionVolume({
        impressions: IMPRESSION_VOLUME_CEILING,
        querySetSize: 5,
      })
    ).toEqual({ score: 100, status: 'active' });
  });

  it('clamps above the ceiling', () => {
    const r = scoreImpressionVolume({
      impressions: IMPRESSION_VOLUME_CEILING * 3,
      querySetSize: 5,
    });
    expect(r.score).toBe(100);
  });

  it('is linear between 0 and ceiling', () => {
    const r = scoreImpressionVolume({
      impressions: IMPRESSION_VOLUME_CEILING / 2,
      querySetSize: 5,
    });
    expect(r.score).toBe(50);
  });

  it('returns insufficientData when query set is empty', () => {
    expect(scoreImpressionVolume({ impressions: 100, querySetSize: 0 }).status).toBe(
      'insufficientData'
    );
  });

  it('returns insufficientData when input is null', () => {
    expect(scoreImpressionVolume(null).status).toBe('insufficientData');
  });
});

describe('scoreCtr', () => {
  it('maps 0 CTR to 0', () => {
    expect(scoreCtr({ impressionWeightedCtr: 0, totalImpressions: 100 }).score).toBe(0);
  });

  it('maps CTR_CEILING to 100', () => {
    expect(scoreCtr({ impressionWeightedCtr: CTR_CEILING, totalImpressions: 100 }).score).toBe(100);
  });

  it('clamps above the ceiling', () => {
    const r = scoreCtr({
      impressionWeightedCtr: CTR_CEILING * 2,
      totalImpressions: 100,
    });
    expect(r.score).toBe(100);
  });

  it('is linear between 0 and ceiling', () => {
    const r = scoreCtr({
      impressionWeightedCtr: CTR_CEILING / 2,
      totalImpressions: 100,
    });
    expect(r.score).toBe(50);
  });

  it('returns insufficientData when totalImpressions is zero', () => {
    expect(scoreCtr({ impressionWeightedCtr: 0.1, totalImpressions: 0 }).status).toBe(
      'insufficientData'
    );
  });

  it('returns insufficientData when impressionWeightedCtr is null', () => {
    expect(scoreCtr({ impressionWeightedCtr: null, totalImpressions: 100 }).status).toBe(
      'insufficientData'
    );
  });
});

describe('rankQualityAt', () => {
  it('returns 100 at position 1', () => {
    expect(rankQualityAt(1)).toBe(100);
  });

  it('returns 50 at position 10', () => {
    expect(rankQualityAt(10)).toBe(50);
  });

  it('returns 0 at position 30', () => {
    expect(rankQualityAt(30)).toBe(0);
  });

  it('interpolates between 1 and 10', () => {
    // halfway between 1 (100) and 10 (50) is position 5.5, score 75
    expect(rankQualityAt(5.5)).toBeCloseTo(75, 1);
  });

  it('interpolates between 10 and 30', () => {
    // halfway between 10 (50) and 30 (0) is position 20, score 25
    expect(rankQualityAt(20)).toBeCloseTo(25, 1);
  });

  it('clamps below position 1 to 100', () => {
    expect(rankQualityAt(0)).toBe(100);
  });

  it('clamps beyond position 30 to 0', () => {
    expect(rankQualityAt(100)).toBe(0);
  });
});

describe('scoreRankQuality', () => {
  it('returns 100 for position 1', () => {
    expect(
      scoreRankQuality({
        impressionWeightedPosition: 1,
        totalImpressions: 100,
      }).score
    ).toBe(100);
  });

  it('returns 0 for position 30', () => {
    expect(
      scoreRankQuality({
        impressionWeightedPosition: 30,
        totalImpressions: 100,
      }).score
    ).toBe(0);
  });

  it('returns insufficientData when totalImpressions is 0', () => {
    expect(
      scoreRankQuality({
        impressionWeightedPosition: 5,
        totalImpressions: 0,
      }).status
    ).toBe('insufficientData');
  });

  it('returns insufficientData when position is null', () => {
    expect(
      scoreRankQuality({
        impressionWeightedPosition: null,
        totalImpressions: 100,
      }).status
    ).toBe('insufficientData');
  });
});

describe('scoreAioPresence', () => {
  it('returns 100 when every query has an AIO citation', () => {
    expect(scoreAioPresence({ aioMatchedCount: 10, querySetSize: 10 }).score).toBe(100);
  });

  it('returns 0 with non-empty query set and no matches (active, not insufficientData)', () => {
    const r = scoreAioPresence({ aioMatchedCount: 0, querySetSize: 10 });
    expect(r.score).toBe(0);
    expect(r.status).toBe('active');
  });

  it('returns 50 for half coverage', () => {
    expect(scoreAioPresence({ aioMatchedCount: 5, querySetSize: 10 }).score).toBe(50);
  });

  it('returns insufficientData when query set is empty', () => {
    expect(scoreAioPresence({ aioMatchedCount: 0, querySetSize: 0 }).status).toBe(
      'insufficientData'
    );
  });
});

function makeActive(id: SeoFactorResult['id'], score: number): SeoFactorResult {
  return {
    id,
    score,
    weight: FACTOR_WEIGHTS[id],
    status: 'active',
    inputs: {},
  };
}

function makeInsufficient(id: SeoFactorResult['id']): SeoFactorResult {
  return {
    id,
    score: null,
    weight: FACTOR_WEIGHTS[id],
    status: 'insufficientData',
    inputs: {},
  };
}

describe('composeScore', () => {
  it('all four factors at 100 produces 100', () => {
    const r = composeScore([
      makeActive('impression_volume', 100),
      makeActive('click_through_rate', 100),
      makeActive('rank_quality', 100),
      makeActive('aio_presence', 100),
    ]);
    expect(r.composite).toBe(100);
    expect(r.compositeRaw).toBe(100);
    expect(r.displayCapApplied).toBe(false);
  });

  it('weighted average respects configured weights', () => {
    // 50/50/100/100 with weights 25/25/30/20 → (50*25 + 50*25 + 100*30 + 100*20) / 100 = 75
    const r = composeScore([
      makeActive('impression_volume', 50),
      makeActive('click_through_rate', 50),
      makeActive('rank_quality', 100),
      makeActive('aio_presence', 100),
    ]);
    expect(r.compositeRaw).toBe(75);
    expect(r.composite).toBe(75);
  });

  it('redistributes weight when one factor is insufficientData', () => {
    // 3 active at 75 with weights 25/25/30 (sum 80) → composite = 75
    const r = composeScore([
      makeActive('impression_volume', 75),
      makeActive('click_through_rate', 75),
      makeActive('rank_quality', 75),
      makeInsufficient('aio_presence'),
    ]);
    expect(r.compositeRaw).toBe(75);
  });

  it('returns INSUFFICIENT_FACTORS when fewer than 3 are active', () => {
    const r = composeScore([
      makeActive('impression_volume', 50),
      makeActive('click_through_rate', 50),
      makeInsufficient('rank_quality'),
      makeInsufficient('aio_presence'),
    ]);
    expect(r.composite).toBeNull();
    expect(r.code).toBe('INSUFFICIENT_FACTORS');
  });

  it('returns INSUFFICIENT_FACTORS when all factors are insufficientData', () => {
    const r = composeScore([
      makeInsufficient('impression_volume'),
      makeInsufficient('click_through_rate'),
      makeInsufficient('rank_quality'),
      makeInsufficient('aio_presence'),
    ]);
    expect(r.composite).toBeNull();
    expect(r.code).toBe('INSUFFICIENT_FACTORS');
  });

  it('never applies a display cap in v1', () => {
    const r = composeScore([
      makeActive('impression_volume', 100),
      makeActive('click_through_rate', 100),
      makeActive('rank_quality', 100),
      makeActive('aio_presence', 100),
    ]);
    expect(r.displayCapApplied).toBe(false);
  });
});

describe('detectAdvisories', () => {
  it('returns empty for a period fully before the bug window', () => {
    expect(detectAdvisories('2024-01-01', '2025-05-12')).toEqual([]);
  });

  it('returns empty for a period fully after the bug window', () => {
    expect(detectAdvisories('2026-04-04', '2026-05-01')).toEqual([]);
  });

  it('returns the advisory for a period inside the bug window', () => {
    expect(detectAdvisories('2025-09-01', '2025-09-30')).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });

  it('returns the advisory when the period overlaps the start boundary', () => {
    expect(detectAdvisories('2025-05-01', '2025-05-14')).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });

  it('returns the advisory when the period overlaps the end boundary', () => {
    expect(detectAdvisories('2026-04-03', '2026-04-30')).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });

  it('returns the advisory when the period fully encloses the window', () => {
    expect(detectAdvisories('2024-01-01', '2030-01-01')).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });
});

describe('FORMULA_VERSION', () => {
  it('is a positive integer', () => {
    expect(FORMULA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(FORMULA_VERSION)).toBe(true);
  });
});

describe('FACTOR_WEIGHTS', () => {
  it('weights sum to 100', () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe('buildFactorResult', () => {
  it('preserves the configured weight', () => {
    const r = buildFactorResult('impression_volume', { score: 50, status: 'active' }, {});
    expect(r.weight).toBe(FACTOR_WEIGHTS.impression_volume);
  });

  it('rounds the score to one decimal place', () => {
    const r = buildFactorResult('impression_volume', { score: 33.3333, status: 'active' }, {});
    expect(r.score).toBe(33.3);
  });

  it('preserves null scores', () => {
    const r = buildFactorResult(
      'impression_volume',
      { score: null, status: 'insufficientData' },
      {}
    );
    expect(r.score).toBeNull();
  });
});
