// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactorResult } from './geo-score.types';
import type { SeoFactorResult } from './seo-score.types';

vi.mock('@/lib/db', () => ({ db: {} }));

vi.mock('@/modules/integrations/gsc-correlation/query-set', () => ({
  selectBrandQuerySet: vi.fn(),
  lowerTrimGscQuery: 'lower_trim_gsc_query',
  lowerTrimInterpolatedPrompt: 'lower_trim_interpolated_prompt',
}));

vi.mock('./geo-score.service', () => ({
  getLatestSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  getRecommendations: vi.fn(),
}));

vi.mock('./seo-score.service', () => ({
  getLatestSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  getRecommendations: vi.fn(),
}));

import * as geoScoreService from './geo-score.service';
import * as seoScoreService from './seo-score.service';
import { getCombinedRecommendations, getDualHistory, getDualScore } from './dual-score.service';

const EMPTY_FACTORS_GEO: FactorResult[] = [];
const EMPTY_FACTORS_SEO: SeoFactorResult[] = [];

function seoSnapshot(
  periodStart: string,
  composite: number | null,
  advisories: Array<'GSC_IMPRESSION_BUG_2025_2026'> = []
) {
  return {
    id: `seoss_${periodStart}`,
    periodStart,
    periodEnd: periodStart,
    granularity: 'monthly',
    platformId: '_all',
    locale: '_all',
    composite,
    compositeRaw: composite,
    displayCapApplied: false,
    formulaVersion: 1,
    contributingPromptSetIds: ['ps_a'],
    querySetSize: 10,
    dataQualityAdvisories: advisories,
    code: null,
    factors: EMPTY_FACTORS_SEO,
    computedAt: new Date(),
  };
}

function geoSnapshot(periodStart: string, composite: number | null) {
  return {
    id: `geoss_${periodStart}`,
    periodStart,
    periodEnd: periodStart,
    granularity: 'monthly',
    platformId: '_all',
    locale: '_all',
    composite,
    compositeRaw: composite,
    displayCapApplied: false,
    formulaVersion: 1,
    contributingPromptSetIds: ['ps_a'],
    factors: EMPTY_FACTORS_GEO,
    computedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getDualScore', () => {
  it('labels correlation with a qualitative descriptor when n >= 10 aligned pairs', async () => {
    const starts = [
      '2025-05-01',
      '2025-06-01',
      '2025-07-01',
      '2025-08-01',
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ];
    const seoSnaps = starts.map((p, i) => seoSnapshot(p, 40 + i * 4));
    const geoSnaps = starts.map((p, i) => geoSnapshot(p, 50 + i * 3));
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[seoSnaps.length - 1]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[geoSnaps.length - 1]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-04-15', 'monthly');
    expect(result.correlation.n).toBeGreaterThanOrEqual(10);
    expect(result.correlation.rho).toBeCloseTo(1, 10);
    expect(result.correlation.label).toBe('strong');
    expect(result.correlation.direction).toBe('positive');
    expect(result.correlation.code).toBeNull();
    expect(result.codes).toEqual([]);
  });

  it('returns earlyReading (numeric rho, no qualitative label) for 6 <= n < 10 aligned pairs', async () => {
    const starts = [
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
    ];
    const seoSnaps = starts.map((p, i) => seoSnapshot(p, 40 + i * 5));
    const geoSnaps = starts.map((p, i) => geoSnapshot(p, 60 + i * 2));
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[0]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[0]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-05-15', 'monthly');
    expect(result.correlation.n).toBe(7);
    expect(result.correlation.rho).toBeCloseTo(1, 10);
    expect(result.correlation.label).toBe('earlyReading');
    expect(result.correlation.direction).toBe('positive');
    expect(result.correlation.code).toBeNull();
  });

  it('returns insufficientData with INSUFFICIENT_WINDOW code when n < 6 aligned pairs', async () => {
    const seoSnaps = [seoSnapshot('2026-01-01', 40), seoSnapshot('2026-02-01', 45)];
    const geoSnaps = [geoSnapshot('2026-01-01', 50), geoSnapshot('2026-02-01', 55)];
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[1]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[1]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-02-15', 'monthly');
    expect(result.correlation.label).toBe('insufficientData');
    expect(result.correlation.code).toBe('insufficientData');
    expect(result.correlation.rho).toBeNull();
    expect(result.correlation.direction).toBeNull();
    expect(result.codes).toContain('INSUFFICIENT_WINDOW');
  });

  it('drops pairs without an aligned period and does not zero-fill', async () => {
    // SEO has periods for Aug..Apr (9 months), GEO only Jan..Apr (4 months).
    // Aligned pairs = 4, below the minimum samples floor.
    const seoSnaps = [
      '2025-08-01',
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ].map((p, i) => seoSnapshot(p, 50 + i));
    const geoSnaps = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'].map((p, i) =>
      geoSnapshot(p, 60 + i)
    );
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[seoSnaps.length - 1]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[geoSnaps.length - 1]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-04-15', 'monthly');
    expect(result.correlation.n).toBe(4);
    expect(result.correlation.label).toBe('insufficientData');
    expect(result.codes).toContain('INSUFFICIENT_WINDOW');
  });

  it('emits NO_SEO_SNAPSHOTS and NO_SNAPSHOTS when only the GEO side has a snapshot', async () => {
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(null);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(null);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue([]);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue([]);

    const result = await getDualScore('ws_a', 'brand_a', '2026-04-15', 'monthly');
    expect(result.seo).toBeNull();
    expect(result.geo).toBeNull();
    expect(result.codes).toEqual(
      expect.arrayContaining([
        'NO_SEO_SNAPSHOTS',
        'NO_GEO_SNAPSHOTS',
        'NO_SNAPSHOTS',
        'INSUFFICIENT_WINDOW',
      ])
    );
    expect(result.correlation.label).toBe('insufficientData');
  });

  it('aggregates SEO-side dataQualityAdvisories into a single unified list', async () => {
    const seoSnaps = [
      seoSnapshot('2025-11-01', 40, ['GSC_IMPRESSION_BUG_2025_2026']),
      seoSnapshot('2025-12-01', 42, ['GSC_IMPRESSION_BUG_2025_2026']),
      seoSnapshot('2026-01-01', 45, []),
      seoSnapshot('2026-02-01', 48, []),
      seoSnapshot('2026-03-01', 50, []),
      seoSnapshot('2026-04-01', 52, []),
    ];
    const geoSnaps = seoSnaps.map((s) => geoSnapshot(s.periodStart, 60));
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[seoSnaps.length - 1]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[geoSnaps.length - 1]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-04-15', 'monthly');
    expect(result.dataQualityAdvisories).toEqual(['GSC_IMPRESSION_BUG_2025_2026']);
  });

  it('computes per-side deltas from the most recent two snapshots in the window', async () => {
    const seoSnaps = [seoSnapshot('2026-03-01', 50), seoSnapshot('2026-04-01', 55)];
    const geoSnaps = [geoSnapshot('2026-03-01', 60), geoSnapshot('2026-04-01', 62)];
    vi.mocked(seoScoreService.getLatestSnapshot).mockResolvedValue(seoSnaps[1]);
    vi.mocked(geoScoreService.getLatestSnapshot).mockResolvedValue(geoSnaps[1]);
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const result = await getDualScore('ws_a', 'brand_a', '2026-04-15', 'monthly');
    expect(result.seo?.delta).toBe(5);
    expect(result.geo?.delta).toBe(2);
  });
});

describe('getDualHistory', () => {
  it('returns only aligned pairs with per-snapshot deltas, ordered by periodStart', async () => {
    const seoSnaps = [
      seoSnapshot('2026-01-01', 40),
      seoSnapshot('2026-02-01', 44),
      seoSnapshot('2026-03-01', null),
      seoSnapshot('2026-04-01', 50),
    ];
    const geoSnaps = [
      geoSnapshot('2026-01-01', 60),
      geoSnapshot('2026-02-01', 62),
      geoSnapshot('2026-04-01', 65),
    ];
    vi.mocked(seoScoreService.listSnapshots).mockResolvedValue(seoSnaps);
    vi.mocked(geoScoreService.listSnapshots).mockResolvedValue(geoSnaps);

    const history = await getDualHistory('ws_a', 'brand_a', '2026-01-01', '2026-04-01', 'monthly');

    expect(history.pairs.map((p) => p.periodStart)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-04-01',
    ]);
    expect(history.pairs[0].seoDelta).toBeNull();
    expect(history.pairs[1].seoDelta).toBe(4);
    expect(history.pairs[2].seoDelta).toBe(6); // skips the nulled March; prev = 44
    expect(history.pairs[2].geoDelta).toBe(3);
  });
});

describe('getCombinedRecommendations', () => {
  // Lax typing inside the helper — the real return type is the union of
  // GeoScoreRecommendation and SeoScoreRecommendation but the test fixture
  // does not need nominal narrowness.
  const rec = (
    source: 'seo' | 'geo',
    factorId: string,
    delta: number,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ) => ({
    factorId: factorId as never,
    severity,
    titleKey: `rec.${factorId}.title`,
    descriptionKey: `rec.${factorId}.description`,
    estimatedPointDelta: delta,
  });

  it('interleaves and sorts by estimatedPointDelta desc, tagging each entry by source', async () => {
    vi.mocked(seoScoreService.getRecommendations).mockResolvedValue([
      rec('seo', 'impression_volume', 8),
      rec('seo', 'click_through_rate', 3),
    ]);
    vi.mocked(geoScoreService.getRecommendations).mockResolvedValue([
      rec('geo', 'citation_frequency', 10),
      rec('geo', 'sentiment_balance', 5),
    ]);

    const result = await getCombinedRecommendations(
      'ws_a',
      'brand_a',
      '2026-04-01',
      '2026-04-30',
      'monthly'
    );
    expect(result.partial).toBe(false);
    expect(result.failedSource).toBeNull();
    expect(
      result.recommendations.map((r) => [r.source, r.factorId, r.estimatedPointDelta])
    ).toEqual([
      ['geo', 'citation_frequency', 10],
      ['seo', 'impression_volume', 8],
      ['geo', 'sentiment_balance', 5],
      ['seo', 'click_through_rate', 3],
    ]);
  });

  it('returns partial=true with failedSource when one side throws', async () => {
    vi.mocked(seoScoreService.getRecommendations).mockResolvedValue([
      rec('seo', 'impression_volume', 5),
    ]);
    vi.mocked(geoScoreService.getRecommendations).mockRejectedValue(new Error('boom'));

    const result = await getCombinedRecommendations(
      'ws_a',
      'brand_a',
      '2026-04-01',
      '2026-04-30',
      'monthly'
    );
    expect(result.partial).toBe(true);
    expect(result.failedSource).toBe('geo');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].source).toBe('seo');
  });

  it('throws when both sides fail', async () => {
    vi.mocked(seoScoreService.getRecommendations).mockRejectedValue(new Error('boom1'));
    vi.mocked(geoScoreService.getRecommendations).mockRejectedValue(new Error('boom2'));

    await expect(
      getCombinedRecommendations('ws_a', 'brand_a', '2026-04-01', '2026-04-30', 'monthly')
    ).rejects.toThrow();
  });
});
