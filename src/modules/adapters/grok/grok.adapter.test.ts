// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { GrokResponsesResponse } from './grok.types';

// Mock logger before importing adapter
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock the client module
const mockCreateResponse = vi.fn();
vi.mock('./grok.client', () => {
  return {
    GrokClient: class MockGrokClient {
      createResponse = mockCreateResponse;
    },
    XAI_API_BASE: 'https://api.x.ai',
  };
});

// Import after mocks are set up
import { GrokAdapter } from './grok.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_grok_1',
  workspaceId: 'ws_test',
  platformId: 'grok',
  displayName: 'Test Grok',
  enabled: true,
  credentials: { apiKey: 'xai-test-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const sampleGrokResponse: GrokResponsesResponse = {
  id: 'resp_grok_abc123',
  model: 'grok-4-1-fast-non-reasoning',
  output: [
    { type: 'web_search_call', id: 'ws_1', status: 'completed' },
    { type: 'x_search_call', id: 'xs_1', status: 'completed' },
    {
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: 'Acme Corp is a leading company in widgets.',
          annotations: [
            {
              type: 'url_citation',
              url: 'https://acme.com',
              title: 'Acme Corp',
              start_index: 0,
              end_index: 9,
            },
          ],
        },
      ],
    },
  ],
  citations: [
    { url: 'https://acme.com', title: 'Acme Corp', source: 'web' },
    {
      url: 'https://x.com/user/status/123',
      title: '@user tweet',
      snippet: 'Acme is great',
      source: 'x',
    },
  ],
  usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70 },
};

describe('GrokAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateResponse.mockResolvedValue({
      body: sampleGrokResponse,
      rateLimits: { remainingRequests: 59 },
    });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new GrokAdapter(baseConfig);

      expect(adapter.platformId).toBe('grok');
      expect(adapter.platformName).toBe('Grok');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new GrokAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('uses custom model from config', () => {
      const config = {
        ...baseConfig,
        config: { model: 'grok-4.20-0309-non-reasoning' },
      };

      const adapter = new GrokAdapter(config);
      expect(adapter.platformId).toBe('grok');
    });

    it('throws PermanentAdapterError for invalid temperature', () => {
      const config = { ...baseConfig, config: { temperature: 3 } };

      expect(() => new GrokAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new GrokAdapter(config)).toThrow('temperature');
    });

    it('throws PermanentAdapterError for negative temperature', () => {
      const config = { ...baseConfig, config: { temperature: -1 } };

      expect(() => new GrokAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for invalid maxOutputTokens', () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 0 } };

      expect(() => new GrokAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new GrokAdapter(config)).toThrow('maxOutputTokens');
    });

    it('throws PermanentAdapterError for non-integer maxOutputTokens', () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 1.5 } };

      expect(() => new GrokAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('accepts valid temperature within range', () => {
      const config = { ...baseConfig, config: { temperature: 1.5 } };

      expect(() => new GrokAdapter(config)).not.toThrow();
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new GrokAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toBe('resp_grok_abc123');
      expect(response.metadata.model).toBe('grok-4-1-fast-non-reasoning');
      expect(response.metadata.tokensUsed).toBe(70);
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(sampleGrokResponse);
    });

    it('builds request with both web_search and x_search tools', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools).toHaveLength(2);
      expect(request.tools[0].type).toBe('web_search');
      expect(request.tools[1].type).toBe('x_search');
    });

    it('excludes x_search when enableXSearch is false', async () => {
      const config = { ...baseConfig, config: { enableXSearch: false } };
      const adapter = new GrokAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools).toHaveLength(1);
      expect(request.tools[0].type).toBe('web_search');
    });

    it('sets store: false and stream: false on all requests', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.store).toBe(false);
      expect(request.stream).toBe(false);
    });

    it('sends system instruction as first message in input array', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.input).toHaveLength(2);
      expect(request.input[0].role).toBe('system');
      expect(request.input[0].content).toContain('Provide factual, well-sourced responses.');
      expect(request.input[1].role).toBe('user');
      expect(request.input[1].content).toBe('test prompt');
    });

    it('includes locale in system instruction when provided', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockCreateResponse.mock.calls[0][0];
      const systemContent = request.input[0].content;
      expect(systemContent).toContain('Respond in de.');
      expect(systemContent).toContain('Focus on results relevant to DE.');
    });

    it('includes config system instruction before baseline', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'Focus on technology brands.' },
      };
      const adapter = new GrokAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      const systemContent = request.input[0].content;
      expect(systemContent).toMatch(
        /Focus on technology brands\.\n\nProvide factual, well-sourced responses\./
      );
    });

    it('uses configured model from config.config.model', async () => {
      const config = { ...baseConfig, config: { model: 'grok-4.20-0309-non-reasoning' } };
      const adapter = new GrokAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.model).toBe('grok-4.20-0309-non-reasoning');
    });

    it('defaults to grok-4-1-fast-non-reasoning when no model configured', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.model).toBe('grok-4-1-fast-non-reasoning');
    });

    it('passes temperature when configured', async () => {
      const config = { ...baseConfig, config: { temperature: 0.5 } };
      const adapter = new GrokAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.temperature).toBe(0.5);
    });

    it('passes max_output_tokens when configured', async () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 2048 } };
      const adapter = new GrokAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.max_output_tokens).toBe(2048);
    });

    it('handles response with empty text content', async () => {
      mockCreateResponse.mockResolvedValueOnce({
        body: {
          id: 'resp_empty',
          model: 'grok-4-1-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 },
        },
        rateLimits: {},
      });

      const adapter = new GrokAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('extracts citations from raw response', async () => {
      const adapter = new GrokAdapter(baseConfig);
      const platformResponse = {
        rawResponse: sampleGrokResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'resp_grok_abc123',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'grok-4-1-fast-non-reasoning',
          tokensUsed: 70,
        },
      };

      const citations = await adapter.extractCitations(platformResponse, {
        name: 'Acme',
        aliases: ['Acme Corp'],
      });

      expect(citations).toHaveLength(2);
      expect(citations[0].url).toBe('https://acme.com');
      expect(citations[0].position).toBe(1);
      // Second citation from top-level (X/Twitter)
      expect(citations[1].url).toBe('https://x.com/user/status/123');
      expect(citations[1].position).toBe(2);
    });

    it('returns empty array for response with no citations', async () => {
      const adapter = new GrokAdapter(baseConfig);
      const platformResponse = {
        rawResponse: {
          id: 'resp_nocite',
          model: 'grok-4-1-fast-non-reasoning',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'No citations here.', annotations: [] }],
            },
          ],
          usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        },
        textContent: 'No citations here.',
        metadata: {
          requestId: 'resp_nocite',
          timestamp: new Date(),
          latencyMs: 50,
          model: 'grok-4-1-fast-non-reasoning',
        },
      };

      const citations = await adapter.extractCitations(platformResponse, {
        name: 'Acme',
        aliases: [],
      });

      expect(citations).toEqual([]);
    });
  });

  describe('healthCheck (via doHealthCheck)', () => {
    it('returns healthy status on success', async () => {
      const adapter = new GrokAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends request without search tools', async () => {
      const adapter = new GrokAdapter(baseConfig);
      await adapter.healthCheck();

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.input).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(request.tools).toBeUndefined();
      expect(request.store).toBe(false);
      expect(request.stream).toBe(false);
    });

    it('returns degraded status on transient error', async () => {
      mockCreateResponse.mockRejectedValueOnce(new TransientAdapterError('Timeout', 'grok'));

      const adapter = new GrokAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockCreateResponse.mockRejectedValueOnce(
        new PermanentAdapterError('Invalid API key', 'grok')
      );

      const adapter = new GrokAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns degraded status on rate limit error', async () => {
      mockCreateResponse.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'grok', 60000)
      );

      const adapter = new GrokAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockCreateResponse.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new GrokAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });
});
