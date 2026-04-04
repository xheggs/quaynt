// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { OpenAIResponsesResponse } from './chatgpt.types';

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
vi.mock('./chatgpt.client', () => {
  return {
    ChatGPTClient: class MockChatGPTClient {
      createResponse = mockCreateResponse;
    },
  };
});

// Import after mocks are set up
import { ChatGPTAdapter } from './chatgpt.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_chatgpt_1',
  workspaceId: 'ws_test',
  platformId: 'chatgpt',
  displayName: 'Test ChatGPT',
  enabled: true,
  credentials: { apiKey: 'sk-test-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const sampleOpenAIResponse: OpenAIResponsesResponse = {
  id: 'resp_abc123',
  model: 'gpt-4o-mini',
  output: [
    {
      type: 'message',
      id: 'msg_1',
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
  usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70 },
};

describe('ChatGPTAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateResponse.mockResolvedValue({
      body: sampleOpenAIResponse,
      rateLimits: { remainingRequests: 59 },
    });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new ChatGPTAdapter(baseConfig);

      expect(adapter.platformId).toBe('chatgpt');
      expect(adapter.platformName).toBe('ChatGPT');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new ChatGPTAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('uses custom model from config', () => {
      const config = {
        ...baseConfig,
        config: { model: 'gpt-4o', searchContextSize: 'high' },
      };

      // Should not throw — config accepted
      const adapter = new ChatGPTAdapter(config);
      expect(adapter.platformId).toBe('chatgpt');
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toBe('resp_abc123');
      expect(response.metadata.model).toBe('gpt-4o-mini');
      expect(response.metadata.tokensUsed).toBe(70);
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(sampleOpenAIResponse);
    });

    it('builds request with web_search tool', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.model).toBe('gpt-4o-mini');
      expect(request.input).toBe('test prompt');
      expect(request.store).toBe(false);
      expect(request.stream).toBe(false);
      expect(request.tools).toHaveLength(1);
      expect(request.tools[0].type).toBe('web_search');
      expect(request.tools[0].search_context_size).toBe('medium');
    });

    it('maps locale to user_location', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en-US' });

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools[0].user_location).toEqual({
        type: 'approximate',
        country: 'US',
      });
    });

    it('maps de-DE locale to country DE', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools[0].user_location).toEqual({
        type: 'approximate',
        country: 'DE',
      });
    });

    it('omits user_location when locale has no region', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en' });

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools[0].user_location).toBeUndefined();
    });

    it('omits user_location when locale is not provided', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.tools[0].user_location).toBeUndefined();
    });

    it('uses configured model from config.config.model', async () => {
      const config = { ...baseConfig, config: { model: 'gpt-4o' } };
      const adapter = new ChatGPTAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.model).toBe('gpt-4o');
    });

    it('defaults to gpt-4o-mini when no model configured', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.model).toBe('gpt-4o-mini');
    });

    it('handles response with empty text content', async () => {
      mockCreateResponse.mockResolvedValueOnce({
        body: {
          id: 'resp_empty',
          model: 'gpt-4o-mini',
          output: [],
          usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 },
        },
        rateLimits: {},
      });

      const adapter = new ChatGPTAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('extracts citations from raw response', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      const platformResponse = {
        rawResponse: sampleOpenAIResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'resp_abc123',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'gpt-4o-mini',
          tokensUsed: 70,
        },
      };

      const citations = await adapter.extractCitations(platformResponse, {
        name: 'Acme',
        aliases: ['Acme Corp'],
      });

      expect(citations).toHaveLength(1);
      expect(citations[0].url).toBe('https://acme.com');
      expect(citations[0].title).toBe('Acme Corp');
      expect(citations[0].position).toBe(1);
    });

    it('returns empty array for response with no citations', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      const platformResponse = {
        rawResponse: {
          id: 'resp_nocite',
          model: 'gpt-4o-mini',
          output: [
            {
              type: 'message',
              id: 'msg_1',
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
          model: 'gpt-4o-mini',
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
      const adapter = new ChatGPTAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends request without web_search tool', async () => {
      const adapter = new ChatGPTAdapter(baseConfig);
      await adapter.healthCheck();

      const request = mockCreateResponse.mock.calls[0][0];
      expect(request.input).toBe('Hello');
      expect(request.tools).toBeUndefined();
      expect(request.store).toBe(false);
      expect(request.stream).toBe(false);
    });

    it('returns degraded status on transient error', async () => {
      mockCreateResponse.mockRejectedValueOnce(new TransientAdapterError('Timeout', 'chatgpt'));

      const adapter = new ChatGPTAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockCreateResponse.mockRejectedValueOnce(
        new PermanentAdapterError('Invalid API key', 'chatgpt')
      );

      const adapter = new ChatGPTAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns degraded status on rate limit error', async () => {
      mockCreateResponse.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'chatgpt', 60000)
      );

      const adapter = new ChatGPTAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockCreateResponse.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new ChatGPTAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });
});
