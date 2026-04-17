// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

const selectFromWhere = vi.fn();
const insertValuesReturning = vi.fn();
const deleteWhere = vi.fn();
let citationRowsForResult: Array<{ id: string; normalizedUrl: string | null }> = [];

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...a: unknown[]) => selectFromWhere(...a),
      }),
    }),
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        delete: () => ({
          where: (...a: unknown[]) => {
            deleteWhere(...a);
            return Promise.resolve();
          },
        }),
        insert: () => ({
          values: (rows: unknown[]) => ({
            returning: () => {
              insertValuesReturning(rows);
              return Promise.resolve((rows as Array<{ id: string }>).map((r) => ({ id: r.id })));
            },
          }),
        }),
      });
    },
    delete: () => ({ where: () => Promise.resolve() }),
  },
}));

const mockDispatchWebhookEvent = vi.fn();
vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...a: unknown[]) => mockDispatchWebhookEvent(...a),
}));

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    id: 'id',
    modelRunResultId: 'modelRunResultId',
    normalizedUrl: 'normalizedUrl',
  },
}));

vi.mock('@/modules/query-fanout/query-fanout.schema', () => ({
  queryFanoutNode: {
    id: 'id',
    modelRunResultId: 'modelRunResultId',
  },
}));

const extractorMock = vi.fn();
vi.mock('./query-fanout.extractor', () => ({
  extractObservedFanout: (...a: unknown[]) => extractorMock(...a),
}));

import { runQueryFanoutForResult } from './query-fanout.service';

const boss = { send: vi.fn() } as unknown as PgBoss;
const log = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function makeInput() {
  return {
    workspaceId: 'ws_1',
    modelRunId: 'run_1',
    result: {
      id: 'runres_1',
      platformId: 'gemini',
      interpolatedPrompt: 'What are the best pm tools?',
      rawResponse: {},
      promptId: 'prompt_1',
    },
    log,
    boss,
  };
}

describe('runQueryFanoutForResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectFromWhere.mockImplementation(() => Promise.resolve(citationRowsForResult));
    citationRowsForResult = [];
  });

  it('skips when extractor returns null (no insert, no webhook)', async () => {
    extractorMock.mockReturnValue(null);

    const out = await runQueryFanoutForResult(makeInput());

    expect(out).toEqual({ skipped: true, reason: 'no-data' });
    expect(insertValuesReturning).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('catches extractor throw and returns skipped', async () => {
    extractorMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const out = await runQueryFanoutForResult(makeInput());

    expect(out).toEqual({ skipped: true, reason: 'extractor-threw' });
    expect(insertValuesReturning).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('inserts root + sub-query + root-source rows and dispatches webhook', async () => {
    extractorMock.mockReturnValue({
      root: { text: 'prompt text' },
      subQueries: [{ text: 'sub a', sources: [] }],
      rootSources: [{ url: 'https://a.com', title: 'A' }],
      metadata: { groundingAttribution: 'root-only' },
    });

    const out = await runQueryFanoutForResult(makeInput());

    expect(out.skipped).toBe(false);
    expect(out.insertedNodes).toBe(3);
    expect(out.rootNodes).toBe(1);
    expect(out.subQueryNodes).toBe(1);
    expect(out.sourceNodes).toBe(1);

    expect(insertValuesReturning).toHaveBeenCalledTimes(1);
    const rows = insertValuesReturning.mock.calls[0][0] as Array<{
      kind: string;
      parentNodeId: string | null;
      subQueryText: string | null;
      sourceUrl: string | null;
      normalizedUrl: string | null;
      citationId: string | null;
    }>;

    const rootRow = rows.find((r) => r.kind === 'root');
    const subQueryRow = rows.find((r) => r.kind === 'sub_query');
    const sourceRow = rows.find((r) => r.kind === 'source');

    expect(rootRow?.parentNodeId).toBeNull();
    expect(rootRow?.subQueryText).toBe('prompt text');
    expect(subQueryRow?.parentNodeId).toBe(rootRow?.['id' as never]);
    expect(sourceRow?.parentNodeId).toBe(rootRow?.['id' as never]);
    expect(sourceRow?.sourceUrl).toBe('https://a.com');
    expect(sourceRow?.normalizedUrl).toBe('https://a.com/');
    expect(sourceRow?.citationId).toBeNull();

    expect(mockDispatchWebhookEvent).toHaveBeenCalledTimes(1);
    const [workspaceId, eventType, payload] = mockDispatchWebhookEvent.mock.calls[0];
    expect(workspaceId).toBe('ws_1');
    expect(eventType).toBe('query_fanout.extracted');
    expect((payload as { insertedNodes: number }).insertedNodes).toBe(3);
    expect((payload as { sourceNodes: number }).sourceNodes).toBe(1);
    expect(payload).not.toHaveProperty('subQueryText');
  });

  it('resolves citationId when a matching normalizedUrl exists', async () => {
    citationRowsForResult = [
      { id: 'cit_abc', normalizedUrl: 'https://a.com/' },
      { id: 'cit_def', normalizedUrl: null },
    ];
    extractorMock.mockReturnValue({
      root: { text: 'prompt' },
      subQueries: [],
      rootSources: [{ url: 'https://a.com', title: 'A' }],
    });

    await runQueryFanoutForResult(makeInput());

    const rows = insertValuesReturning.mock.calls[0][0] as Array<{
      kind: string;
      citationId: string | null;
    }>;
    const source = rows.find((r) => r.kind === 'source');
    expect(source?.citationId).toBe('cit_abc');
  });

  it('resolves citationId to null when no matching URL', async () => {
    citationRowsForResult = [{ id: 'cit_xyz', normalizedUrl: 'https://other.com/' }];
    extractorMock.mockReturnValue({
      root: { text: 'prompt' },
      subQueries: [],
      rootSources: [{ url: 'https://a.com' }],
    });

    await runQueryFanoutForResult(makeInput());

    const rows = insertValuesReturning.mock.calls[0][0] as Array<{
      kind: string;
      citationId: string | null;
    }>;
    const source = rows.find((r) => r.kind === 'source');
    expect(source?.citationId).toBeNull();
  });

  it('deletes existing rows before inserting (idempotent re-run)', async () => {
    extractorMock.mockReturnValue({
      root: { text: 'p' },
      subQueries: [],
      rootSources: [],
    });

    await runQueryFanoutForResult(makeInput());

    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertValuesReturning).toHaveBeenCalledTimes(1);
  });
});
