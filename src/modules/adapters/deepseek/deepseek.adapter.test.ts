// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { DeepSeekChatResponse } from './deepseek.types';

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
const mockCreateChatCompletion = vi.fn();
vi.mock('./deepseek.client', () => {
  return {
    DeepSeekClient: class MockDeepSeekClient {
      createChatCompletion = mockCreateChatCompletion;
    },
    DEEPSEEK_API_BASE: 'https://api.deepseek.com',
  };
});

// Import after mocks are set up
import { DeepSeekAdapter } from './deepseek.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_deepseek_1',
  workspaceId: 'ws_test',
  platformId: 'deepseek',
  displayName: 'Test DeepSeek',
  enabled: true,
  credentials: { apiKey: 'sk-deepseek-test-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const sampleDeepSeekResponse: DeepSeekChatResponse = {
  id: 'chatcmpl-deepseek-abc123',
  object: 'chat.completion',
  model: 'deepseek-chat',
  created: 1700000000,
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Acme Corp is a leading company in widgets.',
      },
    },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
};

describe('DeepSeekAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateChatCompletion.mockResolvedValue({
      body: sampleDeepSeekResponse,
    });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new DeepSeekAdapter(baseConfig);

      expect(adapter.platformId).toBe('deepseek');
      expect(adapter.platformName).toBe('DeepSeek');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new DeepSeekAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('uses custom model from config', () => {
      const config = {
        ...baseConfig,
        config: { model: 'deepseek-reasoner' },
      };

      const adapter = new DeepSeekAdapter(config);
      expect(adapter.platformId).toBe('deepseek');
    });

    it('throws PermanentAdapterError for invalid temperature', () => {
      const config = { ...baseConfig, config: { temperature: 3 } };

      expect(() => new DeepSeekAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new DeepSeekAdapter(config)).toThrow('temperature');
    });

    it('throws PermanentAdapterError for negative temperature', () => {
      const config = { ...baseConfig, config: { temperature: -1 } };

      expect(() => new DeepSeekAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for invalid maxTokens', () => {
      const config = { ...baseConfig, config: { maxTokens: 0 } };

      expect(() => new DeepSeekAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new DeepSeekAdapter(config)).toThrow('maxTokens');
    });

    it('throws PermanentAdapterError for non-integer maxTokens', () => {
      const config = { ...baseConfig, config: { maxTokens: 1.5 } };

      expect(() => new DeepSeekAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('accepts valid temperature within range', () => {
      const config = { ...baseConfig, config: { temperature: 1.5 } };

      expect(() => new DeepSeekAdapter(config)).not.toThrow();
    });

    it('accepts valid maxTokens', () => {
      const config = { ...baseConfig, config: { maxTokens: 4096 } };

      expect(() => new DeepSeekAdapter(config)).not.toThrow();
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toBe('chatcmpl-deepseek-abc123');
      expect(response.metadata.model).toBe('deepseek-chat');
      expect(response.metadata.tokensUsed).toBe(70);
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(sampleDeepSeekResponse);
    });

    it('sets stream: false on all requests', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.stream).toBe(false);
    });

    it('sends system instruction as first message', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[0].content).toContain('Provide factual, detailed responses.');
      expect(request.messages[0].content).toContain(
        'Always respond entirely in the requested language without mixing languages.'
      );
      expect(request.messages[1].role).toBe('user');
      expect(request.messages[1].content).toBe('test prompt');
    });

    it('includes locale in system instruction when provided', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockCreateChatCompletion.mock.calls[0][0];
      const systemContent = request.messages[0].content;
      expect(systemContent).toContain('Respond in de.');
      expect(systemContent).toContain('Focus on results relevant to DE.');
    });

    it('includes config system instruction before baseline', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'Focus on technology brands.' },
      };
      const adapter = new DeepSeekAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      const systemContent = request.messages[0].content;
      expect(systemContent).toMatch(
        /Focus on technology brands\.\n\nProvide factual, detailed responses\./
      );
    });

    it('includes language mixing prevention in baseline instruction', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      const systemContent = request.messages[0].content;
      expect(systemContent).toContain('without mixing languages');
    });

    it('uses configured model', async () => {
      const config = { ...baseConfig, config: { model: 'deepseek-reasoner' } };
      const adapter = new DeepSeekAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.model).toBe('deepseek-reasoner');
    });

    it('defaults to deepseek-chat when no model configured', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.model).toBe('deepseek-chat');
    });

    it('passes temperature when configured', async () => {
      const config = { ...baseConfig, config: { temperature: 0.5 } };
      const adapter = new DeepSeekAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.temperature).toBe(0.5);
    });

    it('passes max_tokens when configured', async () => {
      const config = { ...baseConfig, config: { maxTokens: 2048 } };
      const adapter = new DeepSeekAdapter(config);
      await adapter.query('test prompt');

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.max_tokens).toBe(2048);
    });

    it('handles response with content: null', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({
        body: {
          ...sampleDeepSeekResponse,
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: null },
            },
          ],
        },
      });

      const adapter = new DeepSeekAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });

    it('throws TransientAdapterError on insufficient_system_resource finish reason', async () => {
      mockCreateChatCompletion.mockResolvedValue({
        body: {
          ...sampleDeepSeekResponse,
          choices: [
            {
              index: 0,
              finish_reason: 'insufficient_system_resource',
              message: { role: 'assistant', content: 'partial...' },
            },
          ],
        },
      });

      const adapter = new DeepSeekAdapter(baseConfig);
      await expect(adapter.query('test')).rejects.toThrow(TransientAdapterError);
    });

    it('handles response with empty choices', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({
        body: {
          ...sampleDeepSeekResponse,
          choices: [],
        },
      });

      const adapter = new DeepSeekAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('returns empty array for all responses', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      const platformResponse = {
        rawResponse: sampleDeepSeekResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'chatcmpl-deepseek-abc123',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'deepseek-chat',
          tokensUsed: 70,
        },
      };

      const citations = await adapter.extractCitations(platformResponse, {
        name: 'Acme',
        aliases: ['Acme Corp'],
      });

      expect(citations).toEqual([]);
    });
  });

  describe('healthCheck (via doHealthCheck)', () => {
    it('returns healthy status on success', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends lightweight request with max_tokens: 10', async () => {
      const adapter = new DeepSeekAdapter(baseConfig);
      await adapter.healthCheck();

      const request = mockCreateChatCompletion.mock.calls[0][0];
      expect(request.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(request.max_tokens).toBe(10);
      expect(request.stream).toBe(false);
    });

    it('returns degraded status on transient error', async () => {
      mockCreateChatCompletion.mockRejectedValueOnce(
        new TransientAdapterError('Timeout', 'deepseek')
      );

      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockCreateChatCompletion.mockRejectedValueOnce(
        new PermanentAdapterError('Invalid API key', 'deepseek')
      );

      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns unhealthy with balance message on 402', async () => {
      mockCreateChatCompletion.mockRejectedValueOnce(
        new PermanentAdapterError('DeepSeek API insufficient balance', 'deepseek')
      );

      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('Insufficient API balance');
    });

    it('returns degraded status on rate limit error', async () => {
      mockCreateChatCompletion.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'deepseek', 60000)
      );

      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockCreateChatCompletion.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new DeepSeekAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });
});
