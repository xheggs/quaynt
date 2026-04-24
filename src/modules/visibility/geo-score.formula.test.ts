// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  scoreCitationFrequency,
  scoreSourceDiversity,
  scoreSentimentBalance,
  scorePositionStability,
  scoreAccuracy,
  scoreCoverageBreadth,
  composeScore,
  applyDisplayCap,
  buildFactorResult,
  FACTOR_WEIGHTS,
  FORMULA_VERSION,
  PRE_ACCURACY_CAP,
} from './geo-score.formula';
import type { FactorResult } from './geo-score.types';

describe('scoreCitationFrequency', () => {
  it('returns 0 for 0% share', () => {
    expect(scoreCitationFrequency({ sharePercentage: 0, totalCitations: 0 })).toEqual({
      score: 0,
      status: 'active',
    });
  });

  it('returns 100 at the ceiling', () => {
    expect(scoreCitationFrequency({ sharePercentage: 50, totalCitations: 100 })).toEqual({
      score: 100,
      status: 'active',
    });
  });

  it('clamps above the ceiling', () => {
    const r = scoreCitationFrequency({ sharePercentage: 80, totalCitations: 100 });
    expect(r.score).toBe(100);
  });

  it('is linear between 0 and ceiling', () => {
    const r = scoreCitationFrequency({ sharePercentage: 25, totalCitations: 50 });
    expect(r.score).toBe(50);
  });

  it('returns insufficientData when null', () => {
    expect(scoreCitationFrequency(null).status).toBe('insufficientData');
    expect(scoreCitationFrequency({ sharePercentage: null, totalCitations: 0 }).status).toBe(
      'insufficientData'
    );
  });
});

describe('scoreSourceDiversity', () => {
  it('returns 0 for no domains', () => {
    expect(scoreSourceDiversity({ domainCount: 0 })).toEqual({ score: 0, status: 'active' });
  });

  it('hits 100 at the ceiling', () => {
    const r = scoreSourceDiversity({ domainCount: 30 });
    expect(r.score).toBe(100);
    expect(r.status).toBe('active');
  });

  it('clamps above the ceiling', () => {
    const r = scoreSourceDiversity({ domainCount: 100 });
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('returns insufficientData when null', () => {
    expect(scoreSourceDiversity(null).status).toBe('insufficientData');
  });
});

describe('scoreSentimentBalance', () => {
  it('maps -1 to 0', () => {
    expect(scoreSentimentBalance({ netSentimentScore: -1, totalCitations: 10 })).toEqual({
      score: 0,
      status: 'active',
    });
  });

  it('maps 0 to 50', () => {
    expect(scoreSentimentBalance({ netSentimentScore: 0, totalCitations: 10 })).toEqual({
      score: 50,
      status: 'active',
    });
  });

  it('maps +1 to 100', () => {
    expect(scoreSentimentBalance({ netSentimentScore: 1, totalCitations: 10 })).toEqual({
      score: 100,
      status: 'active',
    });
  });

  it('returns insufficientData when net sentiment is null', () => {
    expect(scoreSentimentBalance({ netSentimentScore: null, totalCitations: 0 }).status).toBe(
      'insufficientData'
    );
  });
});

describe('scorePositionStability', () => {
  const baseWindow = { granularity: 'monthly' as const, periodsUsed: 3 };

  it('returns 100 for perfect first-mention and zero CV', () => {
    expect(scorePositionStability({ firstMentionRate: 1, cv: 0, window: baseWindow })).toEqual({
      score: 100,
      status: 'active',
    });
  });

  it('weights first mention 0.6 and stability 0.4', () => {
    // first = 50, stability = 50 → 0.6*50 + 0.4*50 = 50
    const r = scorePositionStability({ firstMentionRate: 0.5, cv: 0.5, window: baseWindow });
    expect(r.score).toBeCloseTo(50, 0);
  });

  it('returns insufficientData when inputs missing', () => {
    expect(scorePositionStability(null).status).toBe('insufficientData');
    expect(
      scorePositionStability({ firstMentionRate: null, cv: 0.1, window: baseWindow }).status
    ).toBe('insufficientData');
  });
});

describe('scoreAccuracy', () => {
  it('returns notYetScored when input is null', () => {
    expect(scoreAccuracy(null)).toEqual({
      score: null,
      status: 'notYetScored',
      reason: 'accuracy_module_not_live',
    });
  });

  it('returns notYetScored when hallucinationRate is null', () => {
    expect(scoreAccuracy({ hallucinationRate: null }).status).toBe('notYetScored');
  });

  it('returns 100 for 0 hallucination', () => {
    expect(scoreAccuracy({ hallucinationRate: 0 }).score).toBe(100);
  });

  it('returns 0 for 100% hallucination', () => {
    expect(scoreAccuracy({ hallucinationRate: 1 }).score).toBe(0);
  });
});

describe('scoreCoverageBreadth', () => {
  it('returns 100 when observed == expected', () => {
    expect(
      scoreCoverageBreadth({
        observedPairs: 5,
        expectedPairs: 5,
        expectedSource: 'promptSetConfig',
      })
    ).toEqual({ score: 100, status: 'active' });
  });

  it('returns 50 for half coverage', () => {
    const r = scoreCoverageBreadth({
      observedPairs: 5,
      expectedPairs: 10,
      expectedSource: 'promptSetConfig',
    });
    expect(r.score).toBe(50);
  });

  it('returns insufficientData when expectedPairs is null', () => {
    expect(
      scoreCoverageBreadth({ observedPairs: 5, expectedPairs: null, expectedSource: null }).status
    ).toBe('insufficientData');
  });

  it('returns insufficientData when expectedPairs is 0', () => {
    expect(
      scoreCoverageBreadth({
        observedPairs: 0,
        expectedPairs: 0,
        expectedSource: 'promptSetConfig',
      }).status
    ).toBe('insufficientData');
  });
});

function makeActive(id: FactorResult['id'], score: number): FactorResult {
  return {
    id,
    score,
    weight: FACTOR_WEIGHTS[id],
    status: 'active',
    inputs: {},
  };
}

describe('composeScore', () => {
  it('all six factors at 100 produces 100', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 100),
      makeActive('source_diversity', 100),
      makeActive('sentiment_balance', 100),
      makeActive('position_stability', 100),
      makeActive('accuracy', 100),
      makeActive('coverage_breadth', 100),
    ];
    const r = composeScore(factors);
    expect(r.composite).toBe(100);
    expect(r.compositeRaw).toBe(100);
    expect(r.displayCapApplied).toBe(false);
  });

  it('redistributes weight when accuracy is notYetScored, caps at 95', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 100),
      makeActive('source_diversity', 100),
      makeActive('sentiment_balance', 100),
      makeActive('position_stability', 100),
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
      makeActive('coverage_breadth', 100),
    ];
    const r = composeScore(factors);
    expect(r.compositeRaw).toBe(100);
    expect(r.composite).toBe(PRE_ACCURACY_CAP);
    expect(r.displayCapApplied).toBe(true);
  });

  it('returns INSUFFICIENT_FACTORS when fewer than 3 are active', () => {
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 50),
      makeActive('source_diversity', 50),
      {
        id: 'sentiment_balance',
        score: null,
        weight: 15,
        status: 'insufficientData',
        inputs: {},
      },
      {
        id: 'position_stability',
        score: null,
        weight: 15,
        status: 'insufficientData',
        inputs: {},
      },
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
      {
        id: 'coverage_breadth',
        score: null,
        weight: 10,
        status: 'insufficientData',
        inputs: {},
      },
    ];
    const r = composeScore(factors);
    expect(r.composite).toBeNull();
    expect(r.code).toBe('INSUFFICIENT_FACTORS');
  });

  it('citation-count-weighted redistribution is correct', () => {
    // 4 active factors of 75/75/75/75 with weights 25/15/15/15 = sum 70
    // composite = 75 * 70 / 70 = 75
    const factors: FactorResult[] = [
      makeActive('citation_frequency', 75),
      makeActive('source_diversity', 75),
      makeActive('sentiment_balance', 75),
      makeActive('position_stability', 75),
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
      {
        id: 'coverage_breadth',
        score: null,
        weight: 10,
        status: 'insufficientData',
        inputs: {},
      },
    ];
    const r = composeScore(factors);
    expect(r.compositeRaw).toBe(75);
    expect(r.composite).toBe(75);
  });
});

describe('applyDisplayCap', () => {
  it('caps when accuracy is notYetScored', () => {
    const factors: FactorResult[] = [
      { id: 'accuracy', score: null, weight: 20, status: 'notYetScored', inputs: {} },
    ];
    expect(applyDisplayCap(99, factors)).toBe(PRE_ACCURACY_CAP);
    expect(applyDisplayCap(50, factors)).toBe(50);
  });

  it('does not cap when accuracy is active', () => {
    const factors: FactorResult[] = [makeActive('accuracy', 90)];
    expect(applyDisplayCap(99, factors)).toBe(99);
  });
});

describe('FORMULA_VERSION', () => {
  it('is a positive integer', () => {
    expect(FORMULA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(FORMULA_VERSION)).toBe(true);
  });
});

describe('buildFactorResult', () => {
  it('preserves the configured weight', () => {
    const r = buildFactorResult('citation_frequency', { score: 50, status: 'active' }, {});
    expect(r.weight).toBe(FACTOR_WEIGHTS.citation_frequency);
  });
});
