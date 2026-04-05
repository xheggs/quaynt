// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AioAdapter } from './aio.adapter';
import type { AdapterConfig } from '../adapter.types';
import { PermanentAdapterError, TransientAdapterError } from '../adapter.types';
import type { SerpSearchResult } from './aio.types';

// Mock the serp-provider module so we can inject a fake provider
vi.mock('./aio.serp-provider', () => ({
  createSerpProvider: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }),
  },
}));

import { createSerpProvider } from './aio.serp-provider';

const mockCreateSerpProvider = vi.mocked(createSerpProvider);

function baseConfig(overrides?: Partial<AdapterConfig>): AdapterConfig {
  return {
    id: 'adapter-1',
    workspaceId: 'ws-1',
    platformId: 'aio',
    displayName: 'AI Overviews',
    enabled: true,
    credentials: { apiKey: 'test-key' },
    config: { serpProvider: 'searchapi' },
    rateLimitPoints: 60,
    rateLimitDuration: 60,
    timeoutMs: 45_000,
    maxRetries: 3,
    circuitBreakerThreshold: 50,
    circuitBreakerResetMs: 60_000,
    ...overrides,
  };
}

const mockSerpProvider = {
  providerId: 'searchapi',
  search: vi.fn(),
  healthCheck: vi.fn(),
};

function serpResult(overrides?: Partial<SerpSearchResult>): SerpSearchResult {
  return {
    hasAiOverview: true,
    aiOverview: {
      textBlocks: [
        { type: 'paragraph' as const, text: 'First paragraph', referenceIndexes: [0] },
        { type: 'list' as const, text: 'Item 1\nItem 2', referenceIndexes: [] },
      ],
      references: [
        {
          title: 'Example',
          link: 'https://example.com',
          snippet: 'Snippet',
          source: 'example.com',
          index: 0,
        },
      ],
    },
    rawResponse: {},
    requestId: 'req-abc',
    ...overrides,
  };
}

describe('AioAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSerpProvider.mockReturnValue(mockSerpProvider);
    mockSerpProvider.search.mockReset();
    mockSerpProvider.healthCheck.mockReset();
  });

  // -- Constructor ----------------------------------------------------------

  it('constructs successfully with valid searchapi config', () => {
    const adapter = new AioAdapter(baseConfig());
    expect(adapter.platformId).toBe('aio');
    expect(adapter.platformName).toBe('AI Overviews');
  });

  it('constructs successfully with dataforseo config', () => {
    const adapter = new AioAdapter(
      baseConfig({
        config: { serpProvider: 'dataforseo' },
        credentials: { username: 'user', password: 'pass' },
      })
    );
    expect(adapter.platformId).toBe('aio');
  });

  it('throws PermanentAdapterError for unknown serpProvider', () => {
    expect(() => new AioAdapter(baseConfig({ config: { serpProvider: 'unknown' } }))).toThrow(
      PermanentAdapterError
    );
  });

  it('defaults serpProvider to searchapi when not specified', () => {
    new AioAdapter(baseConfig({ config: {} }));
    expect(mockCreateSerpProvider).toHaveBeenCalledWith(
      'searchapi',
      expect.any(Object),
      expect.any(Object),
      expect.any(Object)
    );
  });

  // -- doQuery() ------------------------------------------------------------

  it('passes prompt as search query to provider', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    await adapter.query('What are the best project management tools?', {});

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'What are the best project management tools?',
      expect.objectContaining({})
    );
  });

  it('maps locale to countryCode and languageCode', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    await adapter.query('test', { locale: 'en-US' });

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        countryCode: 'us',
        languageCode: 'en',
      })
    );
  });

  it('maps de-DE locale correctly', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    await adapter.query('test', { locale: 'de-DE' });

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        countryCode: 'de',
        languageCode: 'de',
      })
    );
  });

  it('omits locale params when no locale provided', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    await adapter.query('test', {});

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        countryCode: undefined,
        languageCode: undefined,
      })
    );
  });

  it('concatenates text blocks with newline separator', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.textContent).toBe('First paragraph\nItem 1\nItem 2');
  });

  it('returns empty textContent when no AI Overview', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(
      serpResult({ hasAiOverview: false, aiOverview: undefined })
    );

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.textContent).toBe('');
  });

  it('sets metadata.model to google-aio', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.model).toBe('google-aio');
  });

  it('sets metadata.tokensUsed to undefined', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.tokensUsed).toBeUndefined();
  });

  it('uses requestId from provider or generates synthetic UUID', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult({ requestId: 'serp-id-123' }));

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.requestId).toBe('serp-id-123');
  });

  it('generates synthetic requestId when provider returns none', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult({ requestId: undefined }));

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    // Should be a UUID format
    expect(response.metadata.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('measures latency', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(serpResult());

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // -- doExtractCitations() -------------------------------------------------

  it('delegates citation extraction to citation module', async () => {
    const result = serpResult();
    mockSerpProvider.search.mockResolvedValueOnce(result);

    const adapter = new AioAdapter(baseConfig());
    const response = await adapter.query('test', {});
    const citations = await adapter.extractCitations(response, {
      name: 'Example',
      aliases: [],
    });

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://example.com');
  });

  // -- doHealthCheck() ------------------------------------------------------

  it('returns healthy on successful health check', async () => {
    mockSerpProvider.healthCheck.mockResolvedValueOnce(undefined);

    const adapter = new AioAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded on transient error', async () => {
    mockSerpProvider.healthCheck.mockRejectedValueOnce(new TransientAdapterError('timeout', 'aio'));

    const adapter = new AioAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('degraded');
    expect(health.message).toBe('timeout');
  });

  it('returns unhealthy on permanent error', async () => {
    mockSerpProvider.healthCheck.mockRejectedValueOnce(
      new PermanentAdapterError('Invalid API key', 'aio')
    );

    const adapter = new AioAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('unhealthy');
    expect(health.message).toBe('Invalid API key');
  });
});
