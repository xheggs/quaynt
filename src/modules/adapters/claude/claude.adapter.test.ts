// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { ClaudeMessagesResponse } from './claude.types';

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
const mockSendMessage = vi.fn();
vi.mock('./claude.client', () => {
  return {
    ClaudeClient: class MockClaudeClient {
      sendMessage = mockSendMessage;
    },
    ANTHROPIC_API_BASE: 'https://api.anthropic.com',
    ANTHROPIC_API_VERSION: '2023-06-01',
  };
});

// Import after mocks are set up
import { ClaudeAdapter } from './claude.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_claude_1',
  workspaceId: 'ws_test',
  platformId: 'claude',
  displayName: 'Test Claude',
  enabled: true,
  credentials: { apiKey: 'sk-ant-test-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const sampleClaudeResponse: ClaudeMessagesResponse = {
  id: 'msg_abc123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'Acme Corp is a leading company in widgets.',
      citations: [
        {
          type: 'web_search_result_location',
          url: 'https://acme.com',
          title: 'Acme Corp',
          encrypted_index: 'enc_1',
          cited_text: 'leading company in widgets',
        },
      ],
    },
  ],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  usage: { input_tokens: 50, output_tokens: 20 },
};

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      body: sampleClaudeResponse,
      rateLimits: { requestsRemaining: 49 },
    });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new ClaudeAdapter(baseConfig);

      expect(adapter.platformId).toBe('claude');
      expect(adapter.platformName).toBe('Claude');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new ClaudeAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('uses custom model from config', () => {
      const config = {
        ...baseConfig,
        config: { model: 'claude-sonnet-4-6' },
      };

      const adapter = new ClaudeAdapter(config);
      expect(adapter.platformId).toBe('claude');
    });

    it('throws PermanentAdapterError for empty model string', () => {
      const config = { ...baseConfig, config: { model: '' } };

      expect(() => new ClaudeAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new ClaudeAdapter(config)).toThrow(/model/i);
    });

    it('throws PermanentAdapterError for non-positive maxTokens', () => {
      const config = { ...baseConfig, config: { maxTokens: 0 } };

      expect(() => new ClaudeAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new ClaudeAdapter(config)).toThrow(/maxTokens/i);
    });

    it('throws PermanentAdapterError for non-integer maxTokens', () => {
      const config = { ...baseConfig, config: { maxTokens: 1.5 } };

      expect(() => new ClaudeAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for non-positive maxSearchUses', () => {
      const config = { ...baseConfig, config: { maxSearchUses: 0 } };

      expect(() => new ClaudeAdapter(config)).toThrow(PermanentAdapterError);
      expect(() => new ClaudeAdapter(config)).toThrow(/maxSearchUses/i);
    });

    it('throws PermanentAdapterError for temperature out of range', () => {
      expect(() => new ClaudeAdapter({ ...baseConfig, config: { temperature: -0.1 } })).toThrow(
        PermanentAdapterError
      );
      expect(() => new ClaudeAdapter({ ...baseConfig, config: { temperature: 1.1 } })).toThrow(
        PermanentAdapterError
      );
    });

    it('accepts valid temperature values', () => {
      expect(() => new ClaudeAdapter({ ...baseConfig, config: { temperature: 0 } })).not.toThrow();
      expect(
        () => new ClaudeAdapter({ ...baseConfig, config: { temperature: 0.5 } })
      ).not.toThrow();
      expect(() => new ClaudeAdapter({ ...baseConfig, config: { temperature: 1 } })).not.toThrow();
    });

    it('accepts undefined temperature', () => {
      expect(() => new ClaudeAdapter(baseConfig)).not.toThrow();
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toBe('msg_abc123');
      expect(response.metadata.model).toBe('claude-haiku-4-5-20251001');
      expect(response.metadata.tokensUsed).toBe(70); // 50 + 20
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(sampleClaudeResponse);
    });

    it('builds request with web_search_20250305 tool', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.model).toBe('claude-haiku-4-5-20251001');
      expect(request.max_tokens).toBe(4096);
      expect(request.messages).toEqual([{ role: 'user', content: 'test prompt' }]);
      expect(request.stream).toBe(false);
      expect(request.tools).toHaveLength(1);
      expect(request.tools[0].type).toBe('web_search_20250305');
      expect(request.tools[0].name).toBe('web_search');
      expect(request.tools[0].max_uses).toBe(5);
    });

    it('maps locale to user_location on web search tool', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en-US' });

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].user_location).toEqual({
        type: 'approximate',
        country: 'US',
      });
    });

    it('maps de-DE locale to country DE', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].user_location).toEqual({
        type: 'approximate',
        country: 'DE',
      });
    });

    it('omits user_location when locale has no region', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en' });

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].user_location).toBeUndefined();
    });

    it('omits user_location when locale is not provided', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].user_location).toBeUndefined();
    });

    it('builds system instruction with locale language', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.system).toContain('Respond in de.');
    });

    it('combines config system instruction with locale language', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'Be concise.' },
      };
      const adapter = new ClaudeAdapter(config);
      await adapter.query('test prompt', { locale: 'fr-FR' });

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.system).toBe('Be concise.\n\nRespond in fr.');
    });

    it('uses only config system instruction when no locale', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'Be concise.' },
      };
      const adapter = new ClaudeAdapter(config);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.system).toBe('Be concise.');
    });

    it('omits system field when no locale and no config instruction', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.system).toBeUndefined();
    });

    it('uses configured model from config.config.model', async () => {
      const config = { ...baseConfig, config: { model: 'claude-opus-4-6' } };
      const adapter = new ClaudeAdapter(config);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.model).toBe('claude-opus-4-6');
    });

    it('uses configured maxSearchUses', async () => {
      const config = { ...baseConfig, config: { maxSearchUses: 10 } };
      const adapter = new ClaudeAdapter(config);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].max_uses).toBe(10);
    });

    it('includes temperature when configured', async () => {
      const config = { ...baseConfig, config: { temperature: 0.7 } };
      const adapter = new ClaudeAdapter(config);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.temperature).toBe(0.7);
    });

    it('omits temperature when not configured', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.temperature).toBeUndefined();
    });

    it('handles response with empty content blocks', async () => {
      mockSendMessage.mockResolvedValueOnce({
        body: {
          id: 'msg_empty',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 0 },
        },
        rateLimits: {},
      });

      const adapter = new ClaudeAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('');
    });

    it('concatenates text from multiple text blocks', async () => {
      mockSendMessage.mockResolvedValueOnce({
        body: {
          id: 'msg_multi',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First part. ' },
            { type: 'text', text: 'Second part.' },
          ],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 10 },
        },
        rateLimits: {},
      });

      const adapter = new ClaudeAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('First part. Second part.');
    });

    it('logs warning for web search errors but still returns response', async () => {
      mockSendMessage.mockResolvedValueOnce({
        body: {
          id: 'msg_ws_err',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'web_search_tool_result',
              content: {
                type: 'web_search_tool_result_error',
                error_code: 'too_many_requests',
              },
            },
            { type: 'text', text: 'Response without search.' },
          ],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 10 },
        },
        rateLimits: {},
      });

      const adapter = new ClaudeAdapter(baseConfig);
      const response = await adapter.query('test');

      expect(response.textContent).toBe('Response without search.');
    });

    it('defaults maxTokens to 4096 when not specified', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.max_tokens).toBe(4096);
    });

    it('defaults maxSearchUses to 5 when not specified', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.tools[0].max_uses).toBe(5);
    });

    it('defaults model to claude-haiku-4-5-20251001 when not specified', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.query('test prompt');

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.model).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('extracts citations from raw response', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      const platformResponse = {
        rawResponse: sampleClaudeResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'msg_abc123',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'claude-haiku-4-5-20251001',
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
      expect(citations[0].snippet).toBe('leading company in widgets');
      expect(citations[0].position).toBe(1);
    });

    it('returns empty array for response with no citations', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      const platformResponse = {
        rawResponse: {
          id: 'msg_nocite',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'No citations here.' }],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 5 },
        },
        textContent: 'No citations here.',
        metadata: {
          requestId: 'msg_nocite',
          timestamp: new Date(),
          latencyMs: 50,
          model: 'claude-haiku-4-5-20251001',
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
      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends lightweight request without web search tool', async () => {
      const adapter = new ClaudeAdapter(baseConfig);
      await adapter.healthCheck();

      const request = mockSendMessage.mock.calls[0][0];
      expect(request.messages[0].content).toBe('Hello');
      expect(request.max_tokens).toBe(10);
      expect(request.tools).toBeUndefined();
      expect(request.stream).toBe(false);
    });

    it('returns degraded status on transient error', async () => {
      mockSendMessage.mockRejectedValueOnce(new TransientAdapterError('Timeout', 'claude'));

      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns degraded status on 529 overloaded error', async () => {
      mockSendMessage.mockRejectedValueOnce(
        new TransientAdapterError('Anthropic API overloaded', 'claude')
      );

      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockSendMessage.mockRejectedValueOnce(new PermanentAdapterError('Invalid API key', 'claude'));

      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns degraded status on rate limit error', async () => {
      mockSendMessage.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'claude', 60000)
      );

      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new ClaudeAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });

  describe('factory', () => {
    it('creates adapter from AdapterConfig', () => {
      const adapter = new ClaudeAdapter(baseConfig);

      expect(adapter).toBeInstanceOf(ClaudeAdapter);
      expect(adapter.platformId).toBe('claude');
    });

    it('creates adapter with all config options', () => {
      const config = {
        ...baseConfig,
        config: {
          model: 'claude-sonnet-4-6',
          maxTokens: 8192,
          maxSearchUses: 10,
          temperature: 0.3,
          systemInstruction: 'Be helpful.',
        },
      };

      const adapter = new ClaudeAdapter(config);
      expect(adapter.platformId).toBe('claude');
    });
  });
});
