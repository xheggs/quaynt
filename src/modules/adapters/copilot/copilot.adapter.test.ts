// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotAdapter } from './copilot.adapter';
import type { AdapterConfig } from '../adapter.types';
import { PermanentAdapterError, TransientAdapterError } from '../adapter.types';
import type { CopilotSearchResult } from './copilot.types';

// Mock the serp-provider module so we can inject a fake provider
vi.mock('./copilot.serp-provider', () => ({
  createCopilotSerpProvider: vi.fn(),
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

import { createCopilotSerpProvider } from './copilot.serp-provider';

const mockCreateCopilotSerpProvider = vi.mocked(createCopilotSerpProvider);

function baseConfig(overrides?: Partial<AdapterConfig>): AdapterConfig {
  return {
    id: 'adapter-copilot-1',
    workspaceId: 'ws-1',
    platformId: 'copilot',
    displayName: 'Microsoft Copilot',
    enabled: true,
    credentials: { apiKey: 'test-key' },
    config: { serpProvider: 'dataforseo' },
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
  providerId: 'dataforseo',
  search: vi.fn(),
  healthCheck: vi.fn(),
};

function copilotResult(overrides?: Partial<CopilotSearchResult>): CopilotSearchResult {
  return {
    hasCopilotAnswer: true,
    copilotAnswer: {
      header: 'Copilot header text',
      textBlocks: [
        { type: 'paragraph' as const, text: 'First paragraph', referenceIndexes: [1] },
        { type: 'list' as const, text: 'Item 1\nItem 2', referenceIndexes: [] },
      ],
      references: [
        {
          index: 1,
          title: 'Example',
          link: 'https://example.com',
          snippet: 'Snippet',
          source: 'example.com',
        },
      ],
    },
    rawResponse: {},
    requestId: 'req-copilot-abc',
    ...overrides,
  };
}

describe('CopilotAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCopilotSerpProvider.mockReturnValue(mockSerpProvider);
    mockSerpProvider.search.mockReset();
    mockSerpProvider.healthCheck.mockReset();
  });

  // -- Constructor ----------------------------------------------------------

  it('constructs successfully with valid dataforseo config', () => {
    const adapter = new CopilotAdapter(baseConfig());
    expect(adapter.platformId).toBe('copilot');
    expect(adapter.platformName).toBe('Microsoft Copilot');
  });

  it('constructs successfully with serpapi config', () => {
    const adapter = new CopilotAdapter(
      baseConfig({
        config: { serpProvider: 'serpapi' },
        credentials: { apiKey: 'serp-key' },
      })
    );
    expect(adapter.platformId).toBe('copilot');
  });

  it('throws PermanentAdapterError for unknown serpProvider', () => {
    expect(() => new CopilotAdapter(baseConfig({ config: { serpProvider: 'unknown' } }))).toThrow(
      PermanentAdapterError
    );
  });

  it('defaults serpProvider to dataforseo when not specified', () => {
    new CopilotAdapter(baseConfig({ config: {} }));
    expect(mockCreateCopilotSerpProvider).toHaveBeenCalledWith(
      'dataforseo',
      expect.any(Object),
      expect.any(Object),
      expect.any(Object)
    );
  });

  // -- doQuery() ------------------------------------------------------------

  it('passes prompt as search query to provider', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    await adapter.query('What are the best project management tools?', {});

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'What are the best project management tools?',
      expect.objectContaining({})
    );
  });

  it('maps locale to countryCode and languageCode', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
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
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
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
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    await adapter.query('test', {});

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        countryCode: undefined,
        languageCode: undefined,
      })
    );
  });

  it('concatenates header + text blocks with newline separator', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.textContent).toBe('Copilot header text\nFirst paragraph\nItem 1\nItem 2');
  });

  it('returns text blocks only when no header', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(
      copilotResult({
        copilotAnswer: {
          textBlocks: [
            { type: 'paragraph' as const, text: 'Paragraph only', referenceIndexes: [] },
          ],
          references: [],
        },
      })
    );

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.textContent).toBe('Paragraph only');
  });

  it('returns empty textContent when no Copilot answer', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(
      copilotResult({ hasCopilotAnswer: false, copilotAnswer: undefined })
    );

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.textContent).toBe('');
  });

  it('sets metadata.model to ms-copilot', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.model).toBe('ms-copilot');
  });

  it('sets metadata.tokensUsed to undefined', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.tokensUsed).toBeUndefined();
  });

  it('uses requestId from provider', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult({ requestId: 'serp-id-456' }));

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.requestId).toBe('serp-id-456');
  });

  it('generates synthetic requestId when provider returns none', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult({ requestId: undefined }));

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('measures latency', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(baseConfig());
    const response = await adapter.query('test', {});

    expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('passes noCache to search params', async () => {
    mockSerpProvider.search.mockResolvedValueOnce(copilotResult());

    const adapter = new CopilotAdapter(
      baseConfig({ config: { serpProvider: 'serpapi', noCache: true } })
    );
    await adapter.query('test', {});

    expect(mockSerpProvider.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ noCache: true })
    );
  });

  // -- doExtractCitations() -------------------------------------------------

  it('delegates citation extraction to citation module', async () => {
    const result = copilotResult();
    mockSerpProvider.search.mockResolvedValueOnce(result);

    const adapter = new CopilotAdapter(baseConfig());
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

    const adapter = new CopilotAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded on transient error', async () => {
    mockSerpProvider.healthCheck.mockRejectedValueOnce(
      new TransientAdapterError('timeout', 'copilot')
    );

    const adapter = new CopilotAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('degraded');
    expect(health.message).toBe('timeout');
  });

  it('returns unhealthy on permanent error', async () => {
    mockSerpProvider.healthCheck.mockRejectedValueOnce(
      new PermanentAdapterError('Invalid API key', 'copilot')
    );

    const adapter = new CopilotAdapter(baseConfig());
    const health = await adapter.healthCheck();

    expect(health.status).toBe('unhealthy');
    expect(health.message).toBe('Invalid API key');
  });
});
