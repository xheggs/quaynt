// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { PerplexityChatResponse } from './perplexity.types';

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
const mockCreateCompletion = vi.fn();
vi.mock('./perplexity.client', () => {
  return {
    PerplexityClient: class MockPerplexityClient {
      createCompletion = mockCreateCompletion;
    },
  };
});

// Import after mocks are set up
import { PerplexityAdapter } from './perplexity.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_perplexity_1',
  workspaceId: 'ws_test',
  platformId: 'perplexity',
  displayName: 'Test Perplexity',
  enabled: true,
  credentials: { apiKey: 'pplx-test-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const samplePerplexityResponse: PerplexityChatResponse = {
  id: 'resp_abc123',
  model: 'sonar',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Acme Corp is a leading company in widgets.',
        citations: ['https://acme.com', 'https://widgets.org'],
      },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
};

describe('PerplexityAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCompletion.mockResolvedValue({
      body: samplePerplexityResponse,
      rateLimits: { remainingRequests: 49 },
    });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new PerplexityAdapter(baseConfig);

      expect(adapter.platformId).toBe('perplexity');
      expect(adapter.platformName).toBe('Perplexity');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new PerplexityAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('uses custom model from config', () => {
      const config = {
        ...baseConfig,
        config: { model: 'sonar-pro' },
      };

      const adapter = new PerplexityAdapter(config);
      expect(adapter.platformId).toBe('perplexity');
    });

    it('throws PermanentAdapterError for invalid model', () => {
      const config = {
        ...baseConfig,
        config: { model: 'invalid-model' },
      };

      expect(() => new PerplexityAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for invalid searchRecencyFilter', () => {
      const config = {
        ...baseConfig,
        config: { searchRecencyFilter: 'invalid' },
      };

      expect(() => new PerplexityAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('accepts valid searchRecencyFilter values', () => {
      for (const filter of ['hour', 'day', 'week', 'month', 'year']) {
        const config = {
          ...baseConfig,
          config: { searchRecencyFilter: filter },
        };

        expect(() => new PerplexityAdapter(config)).not.toThrow();
      }
    });

    it('accepts all valid model values', () => {
      for (const model of ['sonar', 'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research']) {
        const config = { ...baseConfig, config: { model } };

        expect(() => new PerplexityAdapter(config)).not.toThrow();
      }
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toBe('resp_abc123');
      expect(response.metadata.model).toBe('sonar');
      expect(response.metadata.tokensUsed).toBe(70);
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(samplePerplexityResponse);
    });

    it('builds request with messages array and stream false', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.model).toBe('sonar');
      expect(request.messages).toEqual([{ role: 'user', content: 'test prompt' }]);
      expect(request.stream).toBe(false);
    });

    it('maps locale to user_location', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en-US' });

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.user_location).toEqual({ country: 'US' });
    });

    it('maps de-DE locale to country DE', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.user_location).toEqual({ country: 'DE' });
    });

    it('omits user_location when locale has no region', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en' });

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.user_location).toBeUndefined();
    });

    it('omits user_location when locale is not provided', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.user_location).toBeUndefined();
    });

    it('uses configured model from config.config.model', async () => {
      const config = { ...baseConfig, config: { model: 'sonar-pro' } };
      const adapter = new PerplexityAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.model).toBe('sonar-pro');
    });

    it('defaults to sonar when no model configured', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.model).toBe('sonar');
    });

    it('passes search_recency_filter when configured', async () => {
      const config = {
        ...baseConfig,
        config: { searchRecencyFilter: 'week' },
      };
      const adapter = new PerplexityAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.search_recency_filter).toBe('week');
    });

    it('passes search_language_filter when configured', async () => {
      const config = {
        ...baseConfig,
        config: { searchLanguageFilter: ['en', 'fr'] },
      };
      const adapter = new PerplexityAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.search_language_filter).toEqual(['en', 'fr']);
    });

    it('omits optional fields when not configured', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.search_recency_filter).toBeUndefined();
      expect(request.search_language_filter).toBeUndefined();
      expect(request.temperature).toBeUndefined();
      expect(request.max_tokens).toBeUndefined();
    });

    it('passes temperature and max_tokens when configured', async () => {
      const config = {
        ...baseConfig,
        config: { temperature: 0.5, maxTokens: 1000 },
      };
      const adapter = new PerplexityAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.temperature).toBe(0.5);
      expect(request.max_tokens).toBe(1000);
    });

    it('handles response with empty text content', async () => {
      mockCreateCompletion.mockResolvedValueOnce({
        body: {
          id: 'resp_empty',
          model: 'sonar',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        },
        rateLimits: {},
      });

      const adapter = new PerplexityAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });

    it('always sets stream to false regardless of config', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.stream).toBe(false);
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('extracts citations from raw response', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      const platformResponse = {
        rawResponse: samplePerplexityResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'resp_abc123',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'sonar',
          tokensUsed: 70,
        },
      };

      const citations = await adapter.extractCitations(platformResponse, {
        name: 'Acme',
        aliases: ['Acme Corp'],
      });

      expect(citations).toHaveLength(2);
      expect(citations[0].url).toBe('https://acme.com');
      expect(citations[0].title).toBe('');
      expect(citations[0].snippet).toBe('');
      expect(citations[0].position).toBe(1);
      expect(citations[1].url).toBe('https://widgets.org');
      expect(citations[1].position).toBe(2);
    });

    it('returns empty array for response with no citations', async () => {
      const adapter = new PerplexityAdapter(baseConfig);
      const platformResponse = {
        rawResponse: {
          id: 'resp_nocite',
          model: 'sonar',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'No citations here.' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        },
        textContent: 'No citations here.',
        metadata: {
          requestId: 'resp_nocite',
          timestamp: new Date(),
          latencyMs: 50,
          model: 'sonar',
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
      const adapter = new PerplexityAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends request with sonar model regardless of configured model', async () => {
      const config = { ...baseConfig, config: { model: 'sonar-pro' } };
      const adapter = new PerplexityAdapter(config);
      await adapter.healthCheck();

      const request = mockCreateCompletion.mock.calls[0][0];
      expect(request.model).toBe('sonar');
      expect(request.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(request.stream).toBe(false);
    });

    it('returns degraded status on transient error', async () => {
      mockCreateCompletion.mockRejectedValueOnce(
        new TransientAdapterError('Timeout', 'perplexity')
      );

      const adapter = new PerplexityAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockCreateCompletion.mockRejectedValueOnce(
        new PermanentAdapterError('Invalid API key', 'perplexity')
      );

      const adapter = new PerplexityAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns degraded status on rate limit error', async () => {
      mockCreateCompletion.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'perplexity', 60000)
      );

      const adapter = new PerplexityAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockCreateCompletion.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new PerplexityAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });
});
