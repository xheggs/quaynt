// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type { GeminiGenerateContentResponse } from './gemini.types';

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
const mockGenerateContent = vi.fn();
vi.mock('./gemini.client', () => {
  return {
    GeminiClient: class MockGeminiClient {
      generateContent = mockGenerateContent;
    },
  };
});

// Import after mocks are set up
import { GeminiAdapter } from './gemini.adapter';

const baseConfig: AdapterConfig = {
  id: 'adapter_gemini_1',
  workspaceId: 'ws_test',
  platformId: 'gemini',
  displayName: 'Test Gemini',
  enabled: true,
  credentials: { apiKey: 'test-gemini-key' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

const sampleGeminiResponse: GeminiGenerateContentResponse = {
  candidates: [
    {
      content: {
        role: 'model',
        parts: [{ text: 'Acme Corp is a leading company in widgets.' }],
      },
      groundingMetadata: {
        groundingChunks: [{ web: { uri: 'https://acme.com', title: 'Acme Corp' } }],
        groundingSupports: [
          {
            segment: { text: 'Acme Corp', startIndex: 0, endIndex: 9 },
            groundingChunkIndices: [0],
            confidenceScores: [0.95],
          },
        ],
        webSearchQueries: ['Acme Corp widgets'],
      },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: {
    promptTokenCount: 50,
    candidatesTokenCount: 20,
    totalTokenCount: 70,
  },
  modelVersion: 'gemini-2.5-flash',
};

describe('GeminiAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue({ body: sampleGeminiResponse });
  });

  describe('constructor', () => {
    it('creates adapter with default config values', () => {
      const adapter = new GeminiAdapter(baseConfig);

      expect(adapter.platformId).toBe('gemini');
      expect(adapter.platformName).toBe('Gemini');
    });

    it('throws PermanentAdapterError when apiKey is missing', () => {
      const configNoKey = { ...baseConfig, credentials: {} };

      expect(() => new GeminiAdapter(configNoKey)).toThrow(PermanentAdapterError);
    });

    it('accepts custom model from config', () => {
      const config = { ...baseConfig, config: { model: 'gemini-2.5-pro' } };

      const adapter = new GeminiAdapter(config);
      expect(adapter.platformId).toBe('gemini');
    });

    it('throws PermanentAdapterError for model with path traversal', () => {
      const config = { ...baseConfig, config: { model: '../etc/passwd' } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for model with slash', () => {
      const config = { ...baseConfig, config: { model: 'models/gemini' } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for apiVersion with path traversal', () => {
      const config = { ...baseConfig, config: { apiVersion: '../v2' } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for invalid safety threshold', () => {
      const config = { ...baseConfig, config: { safetyThreshold: 'BLOCK_EVERYTHING' } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for temperature out of range', () => {
      const config = { ...baseConfig, config: { temperature: 3 } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for negative temperature', () => {
      const config = { ...baseConfig, config: { temperature: -1 } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for non-integer maxOutputTokens', () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 10.5 } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError for zero maxOutputTokens', () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 0 } };

      expect(() => new GeminiAdapter(config)).toThrow(PermanentAdapterError);
    });

    it('accepts valid temperature value', () => {
      const config = { ...baseConfig, config: { temperature: 0.7 } };

      expect(() => new GeminiAdapter(config)).not.toThrow();
    });

    it('accepts valid maxOutputTokens', () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 1024 } };

      expect(() => new GeminiAdapter(config)).not.toThrow();
    });
  });

  describe('query (via doQuery)', () => {
    it('returns normalized PlatformResponse', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('Acme Corp is a leading company in widgets.');
      expect(response.metadata.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(response.metadata.model).toBe('gemini-2.5-flash');
      expect(response.metadata.tokensUsed).toBe(70);
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.rawResponse).toBe(sampleGeminiResponse);
    });

    it('builds request with google_search tool', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt');

      const [model, request] = mockGenerateContent.mock.calls[0];
      expect(model).toBe('gemini-2.5-flash');
      expect(request.contents).toEqual([{ role: 'user', parts: [{ text: 'test prompt' }] }]);
      expect(request.tools).toEqual([{ google_search: {} }]);
    });

    it('applies safety settings to all five harm categories', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.safetySettings).toHaveLength(5);
      for (const setting of request.safetySettings) {
        expect(setting.threshold).toBe('BLOCK_ONLY_HIGH');
      }
      const categories = request.safetySettings.map((s: { category: string }) => s.category);
      expect(categories).toContain('HARM_CATEGORY_HARASSMENT');
      expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH');
      expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
      expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT');
      expect(categories).toContain('HARM_CATEGORY_CIVIC_INTEGRITY');
    });

    it('includes locale as system instruction for en-US', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en-US' });

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.systemInstruction).toBeDefined();
      const text = request.systemInstruction.parts[0].text;
      expect(text).toContain('US');
      expect(text).toContain('en');
    });

    it('includes locale as system instruction for de-DE', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'de-DE' });

      const [, request] = mockGenerateContent.mock.calls[0];
      const text = request.systemInstruction.parts[0].text;
      expect(text).toContain('DE');
      expect(text).toContain('de');
    });

    it('omits system instruction when no locale provided', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.systemInstruction).toBeUndefined();
    });

    it('handles language-only locale (no region)', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt', { locale: 'en' });

      const [, request] = mockGenerateContent.mock.calls[0];
      // Should still have system instruction with language
      expect(request.systemInstruction).toBeDefined();
      const text = request.systemInstruction.parts[0].text;
      expect(text).toContain('en');
    });

    it('combines config systemInstruction with locale instruction', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'You are a brand analyst.' },
      };
      const adapter = new GeminiAdapter(config);
      await adapter.query('test prompt', { locale: 'en-US' });

      const [, request] = mockGenerateContent.mock.calls[0];
      const text = request.systemInstruction.parts[0].text;
      expect(text).toContain('You are a brand analyst.');
      expect(text).toContain('US');
    });

    it('uses config systemInstruction alone when no locale', async () => {
      const config = {
        ...baseConfig,
        config: { systemInstruction: 'You are a brand analyst.' },
      };
      const adapter = new GeminiAdapter(config);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.systemInstruction.parts[0].text).toBe('You are a brand analyst.');
    });

    it('includes generationConfig when temperature is set', async () => {
      const config = { ...baseConfig, config: { temperature: 0.5 } };
      const adapter = new GeminiAdapter(config);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.generationConfig).toBeDefined();
      expect(request.generationConfig.temperature).toBe(0.5);
    });

    it('includes generationConfig when maxOutputTokens is set', async () => {
      const config = { ...baseConfig, config: { maxOutputTokens: 1024 } };
      const adapter = new GeminiAdapter(config);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.generationConfig).toBeDefined();
      expect(request.generationConfig.maxOutputTokens).toBe(1024);
    });

    it('omits generationConfig when no generation options set', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt');

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.generationConfig).toBeUndefined();
    });

    it('defaults to gemini-2.5-flash when no model configured', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.query('test prompt');

      const [model] = mockGenerateContent.mock.calls[0];
      expect(model).toBe('gemini-2.5-flash');
    });

    it('uses configured model', async () => {
      const config = { ...baseConfig, config: { model: 'gemini-2.5-pro' } };
      const adapter = new GeminiAdapter(config);
      await adapter.query('test prompt');

      const [model] = mockGenerateContent.mock.calls[0];
      expect(model).toBe('gemini-2.5-pro');
    });

    it('returns empty textContent when finishReason is SAFETY', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '' }] },
              finishReason: 'SAFETY',
              safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH' }],
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('');
      expect(response.rawResponse).toBeDefined();
    });

    it('returns empty textContent when finishReason is RECITATION', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '' }] },
              finishReason: 'RECITATION',
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('');
    });

    it('returns empty textContent when candidates is empty', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          candidates: [],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('');
    });

    it('returns empty textContent when candidates is undefined', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.textContent).toBe('');
    });

    it('uses modelVersion from response when available', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.metadata.model).toBe('gemini-2.5-flash');
    });

    it('falls back to configured model when modelVersion is absent', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: 'Hello' }] },
              finishReason: 'STOP',
            },
          ],
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.metadata.model).toBe('gemini-2.5-flash');
    });

    it('extracts tokensUsed from usageMetadata.totalTokenCount', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.metadata.tokensUsed).toBe(70);
    });

    it('handles missing usageMetadata', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        body: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: 'Hello' }] },
              finishReason: 'STOP',
            },
          ],
        },
      });

      const adapter = new GeminiAdapter(baseConfig);
      const response = await adapter.query('test prompt');

      expect(response.metadata.tokensUsed).toBeUndefined();
    });
  });

  describe('extractCitations (via doExtractCitations)', () => {
    it('extracts citations from raw response', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      const platformResponse = {
        rawResponse: sampleGeminiResponse,
        textContent: 'Acme Corp is a leading company in widgets.',
        metadata: {
          requestId: 'test-uuid',
          timestamp: new Date(),
          latencyMs: 100,
          model: 'gemini-2.5-flash',
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

    it('returns empty array for response with no grounding data', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      const platformResponse = {
        rawResponse: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: 'No citations' }] },
              finishReason: 'STOP',
            },
          ],
        },
        textContent: 'No citations',
        metadata: {
          requestId: 'test-uuid',
          timestamp: new Date(),
          latencyMs: 50,
          model: 'gemini-2.5-flash',
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
      const adapter = new GeminiAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('sends request without google_search tool', async () => {
      const adapter = new GeminiAdapter(baseConfig);
      await adapter.healthCheck();

      const [, request] = mockGenerateContent.mock.calls[0];
      expect(request.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }]);
      expect(request.tools).toBeUndefined();
    });

    it('returns degraded status on transient error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new TransientAdapterError('Timeout', 'gemini'));

      const adapter = new GeminiAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Timeout');
    });

    it('returns unhealthy status on permanent error', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new PermanentAdapterError('Invalid API key', 'gemini')
      );

      const adapter = new GeminiAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Invalid API key');
    });

    it('returns degraded status on rate limit error', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new RateLimitAdapterError('Rate limited', 'gemini', 60000)
      );

      const adapter = new GeminiAdapter(baseConfig);
      const health = await adapter.healthCheck();

      // RateLimitAdapterError extends TransientAdapterError
      expect(health.status).toBe('degraded');
    });

    it('never throws, always returns HealthStatus', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Unknown error'));

      const adapter = new GeminiAdapter(baseConfig);
      const health = await adapter.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Unknown error');
    });
  });
});
