// @vitest-environment node
import { describe, it, expect } from 'vitest';

import {
  CORRELATION_LABEL_THRESHOLDS,
  DUAL_CORRELATION_LABEL_MIN_SAMPLES,
  DUAL_CORRELATION_MIN_SAMPLES,
  GAP_AI_CITATION_FLOOR,
  GAP_SEO_IMPRESSIONS_FLOOR,
  GAP_SEO_NOISE_FLOOR,
  classifyGapSignal,
  correlationDirection,
  labelCorrelation,
} from './dual-score.formula';

describe('labelCorrelation', () => {
  it('returns insufficientData when n is below the minimum samples floor', () => {
    expect(labelCorrelation(0.9, 0)).toBe('insufficientData');
    expect(labelCorrelation(0.9, DUAL_CORRELATION_MIN_SAMPLES - 1)).toBe('insufficientData');
  });

  it('returns earlyReading for 6 <= n < 10 regardless of rho magnitude', () => {
    for (let n = DUAL_CORRELATION_MIN_SAMPLES; n < DUAL_CORRELATION_LABEL_MIN_SAMPLES; n++) {
      expect(labelCorrelation(0.95, n)).toBe('earlyReading');
      expect(labelCorrelation(-0.95, n)).toBe('earlyReading');
      expect(labelCorrelation(0, n)).toBe('earlyReading');
    }
  });

  it('assigns strong for |rho| >= 0.7 at n >= 10 and preserves sign via direction', () => {
    expect(labelCorrelation(0.7, 10)).toBe('strong');
    expect(labelCorrelation(-0.71, 10)).toBe('strong');
    expect(correlationDirection(0.71)).toBe('positive');
    expect(correlationDirection(-0.71)).toBe('negative');
  });

  it('assigns moderate for 0.4 <= |rho| < 0.7', () => {
    expect(labelCorrelation(0.4, 10)).toBe('moderate');
    expect(labelCorrelation(0.69, 10)).toBe('moderate');
    expect(labelCorrelation(-0.4, 10)).toBe('moderate');
  });

  it('assigns weak for 0.2 <= |rho| < 0.4', () => {
    expect(labelCorrelation(0.2, 10)).toBe('weak');
    expect(labelCorrelation(0.39, 10)).toBe('weak');
    expect(labelCorrelation(-0.2, 10)).toBe('weak');
  });

  it('assigns none for |rho| < 0.2', () => {
    expect(labelCorrelation(0.19, 10)).toBe('none');
    expect(labelCorrelation(0, 10)).toBe('none');
    expect(labelCorrelation(-0.19, 15)).toBe('none');
  });

  it('returns earlyReading when rho is null but n meets the label floor', () => {
    expect(labelCorrelation(null, DUAL_CORRELATION_LABEL_MIN_SAMPLES)).toBe('earlyReading');
  });

  it('thresholds list is ordered descending by min', () => {
    for (let i = 1; i < CORRELATION_LABEL_THRESHOLDS.length; i++) {
      expect(CORRELATION_LABEL_THRESHOLDS[i - 1].min).toBeGreaterThanOrEqual(
        CORRELATION_LABEL_THRESHOLDS[i].min
      );
    }
  });
});

describe('correlationDirection', () => {
  it('returns positive for rho > 0', () => {
    expect(correlationDirection(0.01)).toBe('positive');
  });

  it('returns negative for rho < 0', () => {
    expect(correlationDirection(-0.01)).toBe('negative');
  });

  it('returns flat for rho === 0', () => {
    expect(correlationDirection(0)).toBe('flat');
  });

  it('returns null when rho is null', () => {
    expect(correlationDirection(null)).toBeNull();
  });
});

describe('classifyGapSignal', () => {
  it('returns balanced when both SEO impressions and AIO citations clear their floors', () => {
    expect(
      classifyGapSignal({
        impressions: GAP_SEO_IMPRESSIONS_FLOOR,
        aioCitationCount: GAP_AI_CITATION_FLOOR,
      })
    ).toBe('balanced');
    expect(classifyGapSignal({ impressions: 500, aioCitationCount: 10 })).toBe('balanced');
  });

  it('returns high_seo_no_ai when SEO floor is met and AIO citations are zero', () => {
    expect(
      classifyGapSignal({
        impressions: GAP_SEO_IMPRESSIONS_FLOOR,
        aioCitationCount: 0,
      })
    ).toBe('high_seo_no_ai');
  });

  it('returns no_signal when SEO floor is met and AIO is non-zero but below its floor', () => {
    expect(
      classifyGapSignal({
        impressions: 500,
        aioCitationCount: GAP_AI_CITATION_FLOOR - 1,
      })
    ).toBe('no_signal');
  });

  it('returns high_ai_no_seo when AIO clears its floor and SEO is below the noise floor', () => {
    expect(
      classifyGapSignal({
        impressions: GAP_SEO_NOISE_FLOOR - 1,
        aioCitationCount: GAP_AI_CITATION_FLOOR,
      })
    ).toBe('high_ai_no_seo');
  });

  it('does NOT classify high_ai_no_seo when SEO is at exactly the noise floor', () => {
    expect(
      classifyGapSignal({
        impressions: GAP_SEO_NOISE_FLOOR,
        aioCitationCount: GAP_AI_CITATION_FLOOR,
      })
    ).toBe('no_signal');
  });

  it('returns no_signal when both signals are sub-threshold', () => {
    expect(classifyGapSignal({ impressions: 5, aioCitationCount: 1 })).toBe('no_signal');
    expect(classifyGapSignal({ impressions: 0, aioCitationCount: 0 })).toBe('no_signal');
  });
});
