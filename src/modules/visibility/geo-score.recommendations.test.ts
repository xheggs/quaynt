// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateRecommendations, estimatePointDelta } from './geo-score.recommendations';
import { FACTOR_WEIGHTS } from './geo-score.formula';
import type { FactorResult } from './geo-score.types';

function makeActive(id: FactorResult['id'], score: number): FactorResult {
  return {
    id,
    score,
    weight: FACTOR_WEIGHTS[id],
    status: 'active',
    inputs: {},
  };
}

const STRONG: FactorResult[] = [
  makeActive('citation_frequency', 90),
  makeActive('source_diversity', 90),
  makeActive('sentiment_balance', 90),
  makeActive('position_stability', 90),
  makeActive('accuracy', 90),
  makeActive('coverage_breadth', 90),
];

describe('generateRecommendations', () => {
  it('returns no recommendations when all factors are at/above target', () => {
    expect(generateRecommendations(STRONG)).toEqual([]);
  });

  it('emits a high-severity recommendation for sub-score < 40', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 20),
      makeActive('source_diversity', 90),
      makeActive('sentiment_balance', 90),
      makeActive('position_stability', 90),
      makeActive('accuracy', 90),
      makeActive('coverage_breadth', 90),
    ];
    const recs = generateRecommendations(factors);
    expect(recs.length).toBe(1);
    expect(recs[0].factorId).toBe('citation_frequency');
    expect(recs[0].severity).toBe('high');
  });

  it('emits medium severity for 40-65', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 50),
      makeActive('source_diversity', 90),
      makeActive('sentiment_balance', 90),
      makeActive('position_stability', 90),
      makeActive('accuracy', 90),
      makeActive('coverage_breadth', 90),
    ];
    const recs = generateRecommendations(factors);
    expect(recs[0].severity).toBe('medium');
  });

  it('emits low severity for 65 up to target', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 70),
      makeActive('source_diversity', 90),
      makeActive('sentiment_balance', 90),
      makeActive('position_stability', 90),
      makeActive('accuracy', 90),
      makeActive('coverage_breadth', 90),
    ];
    const recs = generateRecommendations(factors);
    expect(recs[0].severity).toBe('low');
  });

  it('skips notYetScored and insufficientData factors', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 90),
      makeActive('source_diversity', 90),
      { id: 'sentiment_balance', score: null, weight: 15, status: 'insufficientData', inputs: {} },
      makeActive('position_stability', 90),
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
      makeActive('coverage_breadth', 90),
    ];
    expect(generateRecommendations(factors)).toEqual([]);
  });

  it('skips accuracy even when it is active (no rec surface yet)', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 90),
      makeActive('source_diversity', 90),
      makeActive('sentiment_balance', 90),
      makeActive('position_stability', 90),
      makeActive('accuracy', 10),
      makeActive('coverage_breadth', 90),
    ];
    expect(generateRecommendations(factors)).toEqual([]);
  });

  it('sorts recommendations by estimated point-delta desc', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 20), // weight 25
      makeActive('source_diversity', 20), // weight 15
      makeActive('sentiment_balance', 20), // weight 15
      makeActive('position_stability', 90),
      makeActive('accuracy', 90),
      makeActive('coverage_breadth', 90),
    ];
    const recs = generateRecommendations(factors);
    // citation_frequency has highest weight (25), should be first
    expect(recs[0].factorId).toBe('citation_frequency');
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].estimatedPointDelta).toBeGreaterThanOrEqual(recs[i].estimatedPointDelta);
    }
  });
});

describe('estimatePointDelta', () => {
  it('returns a positive delta when lifting a low factor to target', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 20),
      makeActive('source_diversity', 90),
      makeActive('sentiment_balance', 90),
      makeActive('position_stability', 90),
      makeActive('accuracy', 90),
      makeActive('coverage_breadth', 90),
    ];
    const delta = estimatePointDelta(factors, 'citation_frequency');
    expect(delta).toBeGreaterThan(0);
  });

  it('returns 0 when composite is null (no active factors)', () => {
    const factors: FactorResult[] = [
      { id: 'citation_frequency', score: null, weight: 25, status: 'insufficientData', inputs: {} },
      { id: 'source_diversity', score: null, weight: 15, status: 'insufficientData', inputs: {} },
      { id: 'sentiment_balance', score: null, weight: 15, status: 'insufficientData', inputs: {} },
      { id: 'position_stability', score: null, weight: 15, status: 'insufficientData', inputs: {} },
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
      { id: 'coverage_breadth', score: null, weight: 10, status: 'insufficientData', inputs: {} },
    ];
    expect(estimatePointDelta(factors, 'citation_frequency')).toBe(0);
  });
});
