// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a tiny DSL that fakes drizzle's chainable query API. Each `expect.step`
// represents one awaited query in the service. The stubs resolve the next step
// in order.
const queryResponses: unknown[][] = [];

function nextResponse<T = unknown>(): Promise<T[]> {
  const next = queryResponses.shift();
  if (!next) throw new Error('No queued db response for this query');
  return Promise.resolve(next) as Promise<T[]>;
}

const chainable = {
  from: () => chainable,
  where: () => chainable,
  innerJoin: () => chainable,
  groupBy: () => chainable,
  orderBy: () => chainable,
  limit: () => chainable,
  offset: () => chainable,
  then: (resolve: (v: unknown[]) => void) => nextResponse().then(resolve),
};

vi.mock('@/lib/db', () => ({
  db: {
    select: () => chainable,
    selectDistinct: () => chainable,
  },
}));

vi.mock('@/modules/integrations/gsc/gsc-connection.service', () => ({
  listConnections: vi.fn().mockResolvedValue([]),
}));

describe('gsc-correlation.service', () => {
  beforeEach(() => {
    queryResponses.length = 0;
  });

  it('returns zeros when no AIO citations exist in range', async () => {
    queryResponses.push([]); // getAiCitedQueries → empty

    const { getCorrelationSummary } = await import('./gsc-correlation.service');
    const summary = await getCorrelationSummary('ws_A', { from: '2026-04-01', to: '2026-04-15' });

    expect(summary).toEqual({
      aiCitedClicks: 0,
      aiCitedImpressions: 0,
      avgPosition: null,
      distinctQueries: 0,
      gapQueries: 0,
    });
  });

  it('computes impression-weighted avg position and gap-query count', async () => {
    // AI-cited distinct queries detected in range: 3 ("q1", "q2", "q3")
    queryResponses.push([{ q: 'q1' }, { q: 'q2' }, { q: 'q3' }]);
    // GSC aggregate row
    queryResponses.push([
      {
        totalClicks: 100,
        totalImpressions: 1000,
        weightedPositionNumerator: 2500, // avg position = 2.5
        distinctQueries: 2, // q1 and q2 had GSC data; q3 is a gap
      },
    ]);

    const { getCorrelationSummary } = await import('./gsc-correlation.service');
    const summary = await getCorrelationSummary('ws_A', { from: '2026-04-01', to: '2026-04-15' });

    expect(summary.aiCitedClicks).toBe(100);
    expect(summary.aiCitedImpressions).toBe(1000);
    expect(summary.avgPosition).toBe(2.5);
    expect(summary.distinctQueries).toBe(2);
    expect(summary.gapQueries).toBe(1);
  });

  it('returns time series with AI-cited subset zeroed when no AIO citations', async () => {
    queryResponses.push([]); // getAiCitedQueries → empty
    queryResponses.push([
      { date: '2026-04-01', clicks: 10, impressions: 100 },
      { date: '2026-04-02', clicks: 5, impressions: 50 },
    ]); // all-queries aggregate

    const { getCorrelationTimeSeries } = await import('./gsc-correlation.service');
    const series = await getCorrelationTimeSeries('ws_A', { from: '2026-04-01', to: '2026-04-02' });

    expect(series).toHaveLength(2);
    expect(series[0].aiCitedClicks).toBe(0);
    expect(series[0].allClicks).toBe(10);
  });

  it('returns an empty top-queries page when no AIO citations', async () => {
    queryResponses.push([]); // getAiCitedQueries → empty

    const { getTopAiCitedQueries } = await import('./gsc-correlation.service');
    const page = await getTopAiCitedQueries(
      'ws_A',
      { from: '2026-04-01', to: '2026-04-15' },
      { page: 1, limit: 25 }
    );
    expect(page).toEqual({ items: [], total: 0 });
  });
});
