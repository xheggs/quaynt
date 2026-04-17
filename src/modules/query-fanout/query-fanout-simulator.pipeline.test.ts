// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

const state = vi.hoisted(() => {
  return {
    promptRow: null as { id: string; template: string } | null,
    modelRunResultRow: null as { platformId: string } | null,
    insertedRows: [] as Record<string, unknown>[],
  };
});

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: () => {
        // Super simple dispatcher: the next `.from().innerJoin().where().limit()`
        // returns whatever's currently set. Tests arrange state before invoking.
        return {
          from: (table: unknown) => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => (state.promptRow ? [state.promptRow] : []),
              }),
            }),
            where: () => ({
              limit: async () => {
                if (
                  table &&
                  (table as { toString: () => string }).toString().includes('modelRunResult')
                ) {
                  return state.modelRunResultRow ? [state.modelRunResultRow] : [];
                }
                return state.modelRunResultRow ? [state.modelRunResultRow] : [];
              },
            }),
          }),
        };
      },
      transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          insert: () => ({
            values: (rows: Record<string, unknown>[]) => ({
              onConflictDoNothing: () => ({
                returning: async () => {
                  state.insertedRows.push(...rows);
                  return rows.map((r) => ({ id: String(r.id ?? 'qfn_generated') }));
                },
              }),
              returning: async () => {
                state.insertedRows.push(...rows);
                return rows.map((r) => ({ id: String(r.id ?? 'qfn_generated') }));
              },
            }),
          }),
        });
      },
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/modules/prompt-sets/prompt.schema', () => ({
  prompt: { id: 'id', promptSetId: 'promptSetId', template: 'template' },
}));
vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', workspaceId: 'workspaceId' },
}));
vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRunResult: { id: 'id', platformId: 'platformId' },
  modelRun: {},
}));
vi.mock('@/modules/query-fanout/query-fanout.schema', () => ({
  queryFanoutNode: { id: 'id', modelRunResultId: 'modelRunResultId' },
  queryFanoutNodeKind: {},
  queryFanoutNodeSource: {},
}));

const simulateFanoutMock = vi.fn();
vi.mock('./query-fanout-simulator.service', () => ({
  simulateFanout: (...a: unknown[]) => simulateFanoutMock(...a),
}));

const dispatchWebhookEventMock = vi.fn();
vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...a: unknown[]) => dispatchWebhookEventMock(...a),
}));

import { runSimulationPipeline } from './query-fanout-simulator.pipeline';

const boss = {} as PgBoss;

beforeEach(() => {
  state.promptRow = { id: 'prompt_1', template: 'What are the best project management tools?' };
  state.modelRunResultRow = null;
  state.insertedRows = [];
  simulateFanoutMock.mockReset();
  dispatchWebhookEventMock.mockReset();
});

describe('runSimulationPipeline', () => {
  it('returns promptFound=false when the prompt is not in the workspace', async () => {
    state.promptRow = null;
    const result = await runSimulationPipeline({
      workspaceId: 'ws_1',
      promptId: 'prompt_missing',
      boss,
    });
    expect(result.promptFound).toBe(false);
    expect(result.nodesInserted).toBe(0);
    expect(simulateFanoutMock).not.toHaveBeenCalled();
  });

  it('inserts a simulated tree and dispatches the webhook', async () => {
    simulateFanoutMock.mockResolvedValue({
      subQueries: [
        { text: 'alpha', intentType: 'reformulation', priority: 0.9 },
        { text: 'beta', intentType: 'related', priority: 0.5 },
      ],
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      modelVersion: 'gpt-4o-mini-2024-07-18',
      cacheHit: false,
      elapsedMs: 123,
    });
    const result = await runSimulationPipeline({
      workspaceId: 'ws_1',
      promptId: 'prompt_1',
      boss,
    });
    expect(result.promptFound).toBe(true);
    expect(result.nodesInserted).toBe(3); // 1 root + 2 sub-queries
    expect(state.insertedRows.filter((r) => r.source === 'simulated')).toHaveLength(3);
    const sub = state.insertedRows.find((r) => r.kind === 'sub_query');
    expect(sub?.simulationProvider).toBe('openai');
    expect(sub?.simulationModel).toBe('gpt-4o-mini');
    expect(sub?.intentType).toBe('reformulation');
    expect(dispatchWebhookEventMock).toHaveBeenCalledWith(
      'ws_1',
      'query_fanout.simulated',
      expect.objectContaining({ mode: 'simulated', provider: 'openai', subQueryCount: 2 }),
      boss
    );
  });

  it('inherits platformId from the model-run-result row when present', async () => {
    state.modelRunResultRow = { platformId: 'perplexity' };
    simulateFanoutMock.mockResolvedValue({
      subQueries: [{ text: 'alpha', intentType: 'reformulation', priority: 0.9 }],
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      modelVersion: null,
      cacheHit: true,
      elapsedMs: 10,
    });
    const result = await runSimulationPipeline({
      workspaceId: 'ws_1',
      promptId: 'prompt_1',
      modelRunResultId: 'runres_1',
      boss,
    });
    expect(result.promptFound).toBe(true);
    const root = state.insertedRows.find((r) => r.kind === 'root');
    expect(root?.platformId).toBe('perplexity');
  });
});
