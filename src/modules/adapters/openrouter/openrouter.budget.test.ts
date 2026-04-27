// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermanentAdapterError } from '../adapter.types';

// Drizzle's chain is mocked with stand-in builders. Each `select` call
// returns a thenable chain whose final resolution is configurable per call.
const selectQueue: unknown[] = [];

vi.mock('@/lib/db', () => {
  function chain(): unknown {
    const obj = {
      from: () => obj,
      innerJoin: () => obj,
      where: () => obj,
      limit: () => obj,
      then: (resolve: (value: unknown) => void) => resolve(selectQueue.shift() ?? []),
    };
    return obj;
  }
  return { db: { select: () => chain() } };
});

vi.mock('../adapter.schema', () => ({
  platformAdapter: {
    workspaceId: 'workspaceId',
    platformId: 'platformId',
    config: 'config',
    deletedAt: 'deletedAt',
  },
}));

vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: { workspaceId: 'workspaceId', id: 'id' },
  modelRunResult: {
    modelRunId: 'modelRunId',
    platformId: 'platformId',
    responseMetadata: 'responseMetadata',
    createdAt: 'createdAt',
  },
}));

import {
  assertWithinMonthlyBudget,
  registerOpenRouterVirtualPlatformId,
} from './openrouter.budget';

beforeEach(() => {
  selectQueue.length = 0;
  registerOpenRouterVirtualPlatformId('openrouter-sonar-pro');
});

describe('assertWithinMonthlyBudget', () => {
  it('is a no-op when no openrouter row exists', async () => {
    selectQueue.push([]); // first select: shared config lookup → no row

    await expect(
      assertWithinMonthlyBudget({ workspaceId: 'ws_1', platformId: 'openrouter-sonar-pro' })
    ).resolves.toBeUndefined();
  });

  it('is a no-op when monthlyTokenCap is unset', async () => {
    selectQueue.push([{ config: {} }]); // shared config without cap

    await expect(
      assertWithinMonthlyBudget({ workspaceId: 'ws_1', platformId: 'openrouter-sonar-pro' })
    ).resolves.toBeUndefined();
  });

  it('passes when usage is below the cap', async () => {
    selectQueue.push([{ config: { monthlyTokenCap: 1000 } }]); // shared config
    selectQueue.push([{ total: 500 }]); // sum query

    await expect(
      assertWithinMonthlyBudget({ workspaceId: 'ws_1', platformId: 'openrouter-sonar-pro' })
    ).resolves.toBeUndefined();
  });

  it('throws PermanentAdapterError when usage meets or exceeds the cap', async () => {
    selectQueue.push([{ config: { monthlyTokenCap: 1000 } }]);
    selectQueue.push([{ total: 1500 }]);

    await expect(
      assertWithinMonthlyBudget({ workspaceId: 'ws_1', platformId: 'openrouter-sonar-pro' })
    ).rejects.toBeInstanceOf(PermanentAdapterError);
  });

  it('treats non-positive caps as unset', async () => {
    selectQueue.push([{ config: { monthlyTokenCap: 0 } }]);

    await expect(
      assertWithinMonthlyBudget({ workspaceId: 'ws_1', platformId: 'openrouter-sonar-pro' })
    ).resolves.toBeUndefined();
  });
});
