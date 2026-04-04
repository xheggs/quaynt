// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

// -- DB mocks ---------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...a: unknown[]) => mockSelect(...a),
      insert: (...a: unknown[]) => mockInsert(...a),
    },
  };
});

function setupDefaultChain() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
  mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
}

/**
 * Set up mock chain for a standard pipeline run:
 * 1. select().from().where().limit(1) → model run
 * 2. getBrand() → brand (mocked separately)
 * 3. select().from().where() → results array (no .limit())
 * 4. For each result with adapter: select().from().where().limit(1) → adapter config
 */
function setupPipelineMocks(opts: {
  run?: object | null;
  results?: object[];
  adapterConfig?: object | null;
}) {
  setupDefaultChain();

  const { run, results = [], adapterConfig } = opts;

  // Call 1: load model run — select().from().where().limit(1)
  // Call 2: load results — select().from().where() (returns directly, no .limit)
  // Call 3+: load adapter config — select().from().where().limit(1)

  mockSelect.mockImplementation(() => {
    return { from: mockFrom };
  });

  let whereCallCount = 0;
  mockWhere.mockImplementation(() => {
    whereCallCount++;
    if (whereCallCount === 1) {
      // Model run query — needs .limit()
      return { limit: () => (run ? [run] : []) };
    }
    if (whereCallCount === 2) {
      // Results query — returns directly (no .limit())
      return results;
    }
    // Adapter config queries — needs .limit()
    return { limit: () => (adapterConfig ? [adapterConfig] : []) };
  });
}

// -- Schema mocks -----------------------------------------------------------

vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: {
    id: 'id',
    brandId: 'brandId',
    promptSetId: 'promptSetId',
    startedAt: 'startedAt',
    locale: 'locale',
  },
  modelRunResult: {
    id: 'id',
    modelRunId: 'modelRunId',
    platformId: 'platformId',
    adapterConfigId: 'adapterConfigId',
    rawResponse: 'rawResponse',
    textContent: 'textContent',
    responseMetadata: 'responseMetadata',
    interpolatedPrompt: 'interpolatedPrompt',
    status: 'status',
  },
}));

vi.mock('./citation.schema', () => ({
  citation: {
    id: 'id',
    workspaceId: 'workspaceId',
    brandId: 'brandId',
    modelRunId: 'modelRunId',
    modelRunResultId: 'modelRunResultId',
    platformId: 'platformId',
    citationType: 'citationType',
    position: 'position',
    contextSnippet: 'contextSnippet',
    relevanceSignal: 'relevanceSignal',
    sourceUrl: 'sourceUrl',
    title: 'title',
  },
}));

vi.mock('@/modules/adapters/adapter.schema', () => ({
  platformAdapter: {
    id: 'id',
    workspaceId: 'workspaceId',
    platformId: 'platformId',
    displayName: 'displayName',
    enabled: 'enabled',
    credentials: 'credentials',
    config: 'config',
    rateLimitPoints: 'rateLimitPoints',
    rateLimitDuration: 'rateLimitDuration',
    timeoutMs: 'timeoutMs',
    maxRetries: 'maxRetries',
    circuitBreakerThreshold: 'circuitBreakerThreshold',
    circuitBreakerResetMs: 'circuitBreakerResetMs',
    deletedAt: 'deletedAt',
  },
}));

// -- Service mocks ----------------------------------------------------------

const mockGetBrand = vi.fn();
vi.mock('@/modules/brands/brand.service', () => ({
  getBrand: (...args: unknown[]) => mockGetBrand(...args),
}));

const mockCreateInstance = vi.fn();
vi.mock('@/modules/adapters', () => ({
  getAdapterRegistry: vi.fn(() => ({
    createInstance: mockCreateInstance,
  })),
}));

vi.mock('@/modules/adapters/adapter.crypto', () => ({
  decryptCredential: vi.fn(() => '{}'),
}));

vi.mock('@/lib/db/id', () => ({
  generatePrefixedId: vi.fn().mockReturnValue('cit_mock123'),
}));

const mockDispatchWebhookEvent = vi.fn();
vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// -- Test data --------------------------------------------------------------

const sampleRun = {
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  startedAt: new Date('2026-04-03T10:00:00.000Z'),
  locale: null,
};

const sampleBrand = {
  id: 'brand_test1',
  name: 'Acme',
  aliases: ['Acme Corp'],
  domain: 'acme.com',
};

const sampleResult = {
  id: 'runres_test1',
  platformId: 'chatgpt',
  adapterConfigId: 'adapter_test1',
  rawResponse: { output: [] },
  textContent: 'Acme is recommended for project management.',
  responseMetadata: {},
  interpolatedPrompt: 'Tell me about Acme products',
};

const sampleAdapterConfig = {
  id: 'adapter_test1',
  workspaceId: 'ws_test',
  platformId: 'chatgpt',
  displayName: 'ChatGPT',
  enabled: true,
  credentials: null,
  config: {},
  rateLimitPoints: 100,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
};

const mockBoss = { send: vi.fn() } as unknown as PgBoss;

describe('extractCitationsForModelRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultChain();
  });

  it('extracts citations from completed results, classifies as owned, and inserts', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          brandId: 'brand_test1',
          modelRunId: 'run_test1',
          modelRunResultId: 'runres_test1',
          platformId: 'chatgpt',
          citationType: 'owned',
          sourceUrl: 'https://acme.com/page',
          relevanceSignal: 'domain_match',
        }),
      ])
    );

    expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
      'ws_test',
      'citation.new',
      expect.objectContaining({
        citations: expect.arrayContaining([
          expect.objectContaining({ sourceUrl: 'https://acme.com/page' }),
        ]),
      }),
      expect.anything()
    );
  });

  it('classifies citations as earned when brand not in prompt', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [
        {
          ...sampleResult,
          interpolatedPrompt: 'Best project management tools',
          textContent: 'Acme is recommended for project management.',
        },
      ],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'https://acme.com/page', title: 'Acme Page', snippet: '', position: 1 },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ citationType: 'earned' })])
    );
  });

  it('skips results with missing adapter config gracefully', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: null,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('handles run with no completed results gracefully', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [],
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('skips extraction when brand is not found (soft-deleted)', async () => {
    setupPipelineMocks({ run: sampleRun });
    mockGetBrand.mockResolvedValueOnce(null);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws when model run is not found', async () => {
    setupPipelineMocks({ run: null });

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await expect(extractCitationsForModelRun('run_missing', 'ws_test', mockBoss)).rejects.toThrow(
      'Model run run_missing not found'
    );
  });

  it('does not dispatch webhook when no citations are extracted', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [
        {
          ...sampleResult,
          textContent: 'Nothing relevant here.',
          interpolatedPrompt: 'Best tools for project management',
        },
      ],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'https://other.com/page', title: 'Other Page', snippet: 'No brand.', position: 1 },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('handles extractCitations error gracefully (skips result)', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi.fn().mockRejectedValueOnce(new Error('Parse error')),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('enqueues recommendation-share-compute job after citation insertion', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockBoss.send).toHaveBeenCalledWith(
      'recommendation-share-compute',
      {
        workspaceId: 'ws_test',
        promptSetId: 'ps_test1',
        date: '2026-04-03',
      },
      expect.objectContaining({
        singletonKey: 'ws_test:ps_test1:2026-04-03',
        singletonSeconds: 60,
      })
    );
  });

  it('enqueues recommendation-share-compute even when no citations were inserted', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [
        {
          ...sampleResult,
          textContent: 'Nothing relevant here.',
          interpolatedPrompt: 'Best tools for project management',
        },
      ],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'https://other.com/page', title: 'Other Page', snippet: 'No brand.', position: 1 },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    // Should still enqueue even with no citations — affects the denominator
    expect(mockBoss.send).toHaveBeenCalledWith(
      'recommendation-share-compute',
      expect.objectContaining({
        workspaceId: 'ws_test',
        promptSetId: 'ps_test1',
      }),
      expect.any(Object)
    );
  });

  it('handles recommendation-share-compute enqueue failure gracefully', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    // Make boss.send fail for the recommendation share enqueue
    (mockBoss.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Queue error'));

    const { extractCitationsForModelRun } = await import('./citation.pipeline');

    // Should not throw — the error is caught and logged
    await expect(
      extractCitationsForModelRun('run_test1', 'ws_test', mockBoss)
    ).resolves.toBeUndefined();
  });

  // -- Sentiment analysis integration tests ----------------------------------

  it('populates sentiment fields on inserted citations', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sentimentLabel: expect.any(String),
          sentimentScore: expect.any(String),
          sentimentConfidence: expect.any(String),
        }),
      ])
    );
  });

  it('assigns positive sentiment to clearly positive citation snippet', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [
        {
          ...sampleResult,
          textContent: 'Acme is an excellent and wonderful product that is highly recommended.',
        },
      ],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi.fn().mockResolvedValueOnce([
        {
          url: 'https://acme.com/page',
          title: 'Acme Page',
          snippet: 'Acme is an excellent and wonderful product that is highly recommended.',
          position: 1,
        },
      ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sentimentLabel: 'positive',
        }),
      ])
    );
  });

  it('assigns neutral sentiment with zero confidence to empty contextSnippet', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'https://acme.com/page', title: 'Acme Page', snippet: '', position: 1 },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sentimentLabel: 'neutral',
          sentimentScore: '0',
          sentimentConfidence: '0',
        }),
      ])
    );
  });

  it('enqueues sentiment-aggregate-compute job after citation insertion', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockBoss.send).toHaveBeenCalledWith(
      'sentiment-aggregate-compute',
      {
        workspaceId: 'ws_test',
        promptSetId: 'ps_test1',
        date: '2026-04-03',
      },
      expect.objectContaining({
        singletonKey: 'sentiment:ws_test:ps_test1:2026-04-03',
        singletonSeconds: 60,
      })
    );
  });

  it('handles sentiment-aggregate-compute enqueue failure gracefully', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    // First boss.send succeeds (rec share), second fails (sentiment)
    (mockBoss.send as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('job_1')
      .mockRejectedValueOnce(new Error('Queue error'));

    const { extractCitationsForModelRun } = await import('./citation.pipeline');

    await expect(
      extractCitationsForModelRun('run_test1', 'ws_test', mockBoss)
    ).resolves.toBeUndefined();
  });

  // -- URL normalization and citation source tracking tests -------------------

  it('populates normalizedUrl and domain on inserted citations', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://www.acme.com/page?utm_source=twitter',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedUrl: 'https://acme.com/page',
          domain: 'acme.com',
        }),
      ])
    );
  });

  it('sets normalizedUrl and domain to null for malformed sourceUrl', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce({
      ...sampleBrand,
      name: 'Test',
      aliases: ['Test'],
      domain: 'test.com',
    });

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'not-a-valid-url', title: 'Bad URL', snippet: 'Test is mentioned.', position: 1 },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedUrl: null,
          domain: null,
        }),
      ])
    );
  });

  it('enqueues citation-source-compute job after citation insertion', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    const { extractCitationsForModelRun } = await import('./citation.pipeline');
    await extractCitationsForModelRun('run_test1', 'ws_test', mockBoss);

    expect(mockBoss.send).toHaveBeenCalledWith(
      'citation-source-compute',
      {
        workspaceId: 'ws_test',
        promptSetId: 'ps_test1',
        date: '2026-04-03',
      },
      expect.objectContaining({
        singletonKey: 'citation-source:ws_test:ps_test1:2026-04-03',
        singletonSeconds: 60,
      })
    );
  });

  it('handles citation-source-compute enqueue failure gracefully', async () => {
    setupPipelineMocks({
      run: sampleRun,
      results: [sampleResult],
      adapterConfig: sampleAdapterConfig,
    });
    mockGetBrand.mockResolvedValueOnce(sampleBrand);

    const mockAdapter = {
      extractCitations: vi
        .fn()
        .mockResolvedValueOnce([
          {
            url: 'https://acme.com/page',
            title: 'Acme Page',
            snippet: 'Great tools.',
            position: 1,
          },
        ]),
    };
    mockCreateInstance.mockReturnValueOnce(mockAdapter);
    mockReturning.mockReturnValueOnce([{ id: 'cit_mock123' }]);

    // rec share succeeds, sentiment succeeds, citation source fails
    (mockBoss.send as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('job_1')
      .mockResolvedValueOnce('job_2')
      .mockRejectedValueOnce(new Error('Queue error'));

    const { extractCitationsForModelRun } = await import('./citation.pipeline');

    await expect(
      extractCitationsForModelRun('run_test1', 'ws_test', mockBoss)
    ).resolves.toBeUndefined();
  });
});
