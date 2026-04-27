// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterMetadata } from './adapter.types';

// Drizzle chain stub: select() → from() → where() → limit() returns the next
// queued result.
const selectQueue: unknown[] = [];

vi.mock('@/lib/db', () => {
  function chain(): unknown {
    const obj = {
      from: () => obj,
      where: () => obj,
      limit: () => Promise.resolve(selectQueue.shift() ?? []),
    };
    return obj;
  }
  return { db: { select: () => chain() } };
});

vi.mock('./adapter.schema', () => ({
  platformAdapter: {
    workspaceId: 'workspaceId',
    platformId: 'platformId',
    credentials: 'credentials',
    deletedAt: 'deletedAt',
  },
}));

vi.mock('./adapter.crypto', () => ({
  encryptCredential: vi.fn(),
  decryptCredential: vi.fn().mockImplementation((value) => {
    // Round-trip the ciphertext as the JSON payload for assertion clarity.
    return JSON.stringify({ resolvedFromIv: (value as { iv: string }).iv });
  }),
}));

import { resolveCredentialsForAdapter } from './adapter.service';
import type { AdapterRegistry } from './adapter.registry';

function makeRegistry(metadata: AdapterMetadata | undefined): AdapterRegistry {
  return {
    getMetadata: vi.fn().mockReturnValue(metadata),
  } as unknown as AdapterRegistry;
}

const baseMetadata: AdapterMetadata = {
  platformId: 'openrouter-sonar-pro',
  displayName: 'OpenRouter — Sonar Pro',
  version: '1.0.0',
  apiVersion: 'v1',
  capabilities: [],
  credentialSchema: [],
  healthCheckStrategy: 'lightweight_query',
};

beforeEach(() => {
  selectQueue.length = 0;
});

describe('resolveCredentialsForAdapter', () => {
  it('uses the adapter row credentials when no credentialSource is set', async () => {
    const record = {
      workspaceId: 'ws_1',
      platformId: 'perplexity',
      credentials: { ciphertext: 'cx', iv: 'native-iv', tag: 't', keyVersion: 1 },
    };
    const registry = makeRegistry({ ...baseMetadata, platformId: 'perplexity' });

    const creds = await resolveCredentialsForAdapter(record, registry);

    expect(creds).toEqual({ resolvedFromIv: 'native-iv' });
  });

  it('returns {} when no credentials are set on the row and no credentialSource', async () => {
    const record = { workspaceId: 'ws_1', platformId: 'perplexity', credentials: {} };
    const registry = makeRegistry({ ...baseMetadata, platformId: 'perplexity' });

    const creds = await resolveCredentialsForAdapter(record, registry);

    expect(creds).toEqual({});
  });

  it('redirects to source platform credentials when credentialSource is set', async () => {
    selectQueue.push([
      { credentials: { ciphertext: 'cx2', iv: 'shared-iv', tag: 't2', keyVersion: 1 } },
    ]);

    const record = {
      workspaceId: 'ws_1',
      platformId: 'openrouter-sonar-pro',
      credentials: {}, // own credentials are irrelevant
    };
    const registry = makeRegistry({
      ...baseMetadata,
      credentialSource: 'openrouter',
    });

    const creds = await resolveCredentialsForAdapter(record, registry);

    expect(creds).toEqual({ resolvedFromIv: 'shared-iv' });
  });

  it('throws a clear error when credentialSource is set but the source row is missing', async () => {
    selectQueue.push([]); // no row

    const record = {
      workspaceId: 'ws_1',
      platformId: 'openrouter-sonar-pro',
      credentials: {},
    };
    const registry = makeRegistry({ ...baseMetadata, credentialSource: 'openrouter' });

    await expect(resolveCredentialsForAdapter(record, registry)).rejects.toThrow(
      /requires shared credentials from "openrouter"/
    );
  });

  it('throws when credentialSource row exists but has no credentials yet', async () => {
    selectQueue.push([{ credentials: {} }]); // row exists, no creds

    const record = {
      workspaceId: 'ws_1',
      platformId: 'openrouter-sonar-pro',
      credentials: {},
    };
    const registry = makeRegistry({ ...baseMetadata, credentialSource: 'openrouter' });

    await expect(resolveCredentialsForAdapter(record, registry)).rejects.toThrow(
      /requires shared credentials/
    );
  });
});
