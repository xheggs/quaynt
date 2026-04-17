// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }) },
}));
vi.mock('./ai-visit.schema', () => ({
  aiVisit: {
    workspaceId: 'workspaceId',
    visitedAt: 'visitedAt',
    source: 'source',
    platform: 'platform',
    landingPath: 'landingPath',
  },
}));
vi.mock('./traffic-aggregate.schema', () => ({
  trafficDailyAggregate: {
    workspaceId: 'workspaceId',
    periodStart: 'periodStart',
    source: 'source',
    platform: 'platform',
    visitCount: 'visitCount',
    uniquePages: 'uniquePages',
    topPages: 'topPages',
  },
}));

describe('computeRollups', () => {
  it('generates per-source, per-platform, and workspace-wide _all_ rows', async () => {
    const { computeRollups } = await import('./traffic-aggregate.compute');

    const base = [
      {
        source: 'snippet',
        platform: 'chatgpt',
        visitCount: 100,
        uniquePages: 10,
        topPages: [
          { path: '/blog', count: 60 },
          { path: '/pricing', count: 40 },
        ],
      },
      {
        source: 'snippet',
        platform: 'perplexity',
        visitCount: 50,
        uniquePages: 8,
        topPages: [{ path: '/blog', count: 50 }],
      },
      {
        source: 'log',
        platform: 'chatgpt',
        visitCount: 25,
        uniquePages: 3,
        topPages: [{ path: '/blog', count: 25 }],
      },
    ];

    const rollups = computeRollups(base);

    // Expect per-source (snippet/log → _all_ platform) — 2 rows
    // + per-platform (chatgpt/perplexity → _all_ source) — 2 rows
    // + workspace total (_all_/_all_) — 1 row
    expect(rollups).toHaveLength(5);

    const all = rollups.find((r) => r.source === '_all_' && r.platform === '_all_');
    expect(all?.visitCount).toBe(175);

    const snippetAll = rollups.find((r) => r.source === 'snippet' && r.platform === '_all_');
    expect(snippetAll?.visitCount).toBe(150);

    const chatgptAll = rollups.find((r) => r.source === '_all_' && r.platform === 'chatgpt');
    expect(chatgptAll?.visitCount).toBe(125);

    // Workspace-total top pages are sorted and merged across dimensions.
    expect(all?.topPages[0]).toEqual({ path: '/blog', count: 135 });
    expect(all?.topPages[1]).toEqual({ path: '/pricing', count: 40 });
  });

  it('handles an empty base set', async () => {
    const { computeRollups } = await import('./traffic-aggregate.compute');
    const rollups = computeRollups([]);
    expect(rollups).toHaveLength(1); // just the workspace _all_/_all_ row
    expect(rollups[0]).toEqual({
      source: '_all_',
      platform: '_all_',
      visitCount: 0,
      uniquePages: 0,
      topPages: [],
    });
  });
});
