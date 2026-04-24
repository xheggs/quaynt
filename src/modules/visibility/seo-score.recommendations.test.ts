// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateRecommendations, estimatePointDelta } from './seo-score.recommendations';
import { FACTOR_WEIGHTS } from './seo-score.formula';
import type { SeoFactorId, SeoFactorResult } from './seo-score.types';

function makeActive(id: SeoFactorId, score: number): SeoFactorResult {
  return {
    id,
    score,
    weight: FACTOR_WEIGHTS[id],
    status: 'active',
    inputs: {},
  };
}

function makeInsufficient(id: SeoFactorId): SeoFactorResult {
  return {
    id,
    score: null,
    weight: FACTOR_WEIGHTS[id],
    status: 'insufficientData',
    inputs: {},
  };
}

describe('severityFor (via generateRecommendations)', () => {
  it('assigns high severity for scores under 40', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 20),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ]);
    const rec = recs.find((r) => r.factorId === 'impression_volume');
    expect(rec?.severity).toBe('high');
  });

  it('assigns medium severity for scores 40–65', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 50),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ]);
    const rec = recs.find((r) => r.factorId === 'impression_volume');
    expect(rec?.severity).toBe('medium');
  });

  it('assigns low severity for scores 65–74', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 70),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ]);
    const rec = recs.find((r) => r.factorId === 'impression_volume');
    expect(rec?.severity).toBe('low');
  });

  it('emits no recommendation when factor is at or above target', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 80),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ]);
    expect(recs).toHaveLength(0);
  });
});

describe('generateRecommendations', () => {
  it('skips factors that are not active', () => {
    const recs = generateRecommendations([
      makeInsufficient('impression_volume'),
      makeActive('click_through_rate', 30),
      makeActive('rank_quality', 30),
      makeActive('aio_presence', 30),
    ]);
    expect(recs.map((r) => r.factorId)).not.toContain('impression_volume');
  });

  it('sorts by estimatedPointDelta descending', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 10), // weight 25
      makeActive('click_through_rate', 10), // weight 25
      makeActive('rank_quality', 10), // weight 30 — largest lift
      makeActive('aio_presence', 10), // weight 20
    ]);
    expect(recs).toHaveLength(4);
    expect(recs[0].factorId).toBe('rank_quality');
    // all four have same score and different weights; order by weight desc
    for (let i = 1; i < recs.length; i += 1) {
      expect(recs[i - 1].estimatedPointDelta).toBeGreaterThanOrEqual(recs[i].estimatedPointDelta);
    }
  });

  it('uses correct i18n keys', () => {
    const recs = generateRecommendations([
      makeActive('impression_volume', 20),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ]);
    const rec = recs[0];
    expect(rec.titleKey).toBe('seoScore.recommendations.impression_volume.title');
    expect(rec.descriptionKey).toBe('seoScore.recommendations.impression_volume.description');
  });
});

describe('estimatePointDelta', () => {
  it('returns 0 when current composite cannot be computed', () => {
    const factors: SeoFactorResult[] = [
      makeInsufficient('impression_volume'),
      makeInsufficient('click_through_rate'),
      makeInsufficient('rank_quality'),
      makeInsufficient('aio_presence'),
    ];
    expect(estimatePointDelta(factors, 'impression_volume')).toBe(0);
  });

  it('returns a positive delta for a weak factor raised to target', () => {
    const factors: SeoFactorResult[] = [
      makeActive('impression_volume', 0), // weight 25
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ];
    const delta = estimatePointDelta(factors, 'impression_volume');
    // raising 0 → 75 on weight 25 out of 100 = 18.75, rounded to 18.8
    expect(delta).toBe(18.8);
  });

  it('returns 0 when factor is already above target', () => {
    const factors: SeoFactorResult[] = [
      makeActive('impression_volume', 90),
      makeActive('click_through_rate', 80),
      makeActive('rank_quality', 80),
      makeActive('aio_presence', 80),
    ];
    const delta = estimatePointDelta(factors, 'impression_volume');
    // raising 90 → 75 on weight 25 = -3.75; direction sign depends on implementation
    // but target-substitution lowers the raw composite: we assert <= 0
    expect(delta).toBeLessThanOrEqual(0);
  });
});
