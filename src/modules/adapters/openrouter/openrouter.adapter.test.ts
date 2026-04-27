// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdapterConfig } from '../adapter.types';
import { PermanentAdapterError } from '../adapter.types';
import type { OpenRouterChatResponse, OpenRouterPlatformConfig } from './openrouter.types';

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

const mockCreateChatCompletion = vi.fn();
vi.mock('./openrouter.client', () => {
  return {
    OpenRouterClient: class MockOpenRouterClient {
      createChatCompletion = mockCreateChatCompletion;
    },
    OPENROUTER_API_BASE: 'https://openrouter.ai/api/v1',
  };
});

// Stub out the budget helper — exercised separately in openrouter.budget.test.ts.
vi.mock('./openrouter.budget', () => ({
  assertWithinMonthlyBudget: vi.fn().mockResolvedValue(undefined),
  registerOpenRouterVirtualPlatformId: vi.fn(),
  getOpenRouterVirtualPlatformIds: vi.fn().mockReturnValue([]),
}));

import { OpenRouterAdapter } from './openrouter.adapter';

function makeConfig(platformId: string, overrides: Partial<AdapterConfig> = {}): AdapterConfig {
  return {
    id: `adapter_${platformId}_1`,
    workspaceId: 'ws_test',
    platformId,
    displayName: `Test ${platformId}`,
    enabled: true,
    credentials: { apiKey: 'sk-or-test-key' },
    config: {},
    rateLimitPoints: 60,
    rateLimitDuration: 60,
    timeoutMs: 30_000,
    maxRetries: 3,
    circuitBreakerThreshold: 50,
    circuitBreakerResetMs: 60_000,
    ...overrides,
  };
}

const sonarStatic: OpenRouterPlatformConfig = {
  orModel: 'perplexity/sonar-pro',
  citationStyle: 'sonar',
};

const onlineStatic: OpenRouterPlatformConfig = {
  orModel: 'openai/gpt-4o:online',
  citationStyle: 'online',
};

const sonarResponse: OpenRouterChatResponse = {
  id: 'gen-or-sonar-1',
  model: 'perplexity/sonar-pro',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Acme Corp leads in widgets.',
        citations: ['https://acme.example/widgets', 'https://acme.example/widgets'],
      },
    },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
};

const onlineResponse: OpenRouterChatResponse = {
  id: 'gen-or-gpt4o-1',
  model: 'openai/gpt-4o',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Acme Corp is a leader.',
        annotations: [
          {
            type: 'url_citation',
            url_citation: {
              url: 'https://acme.example/about',
              title: 'About Acme',
              content: 'Acme Corp is a leading…',
            },
          },
          {
            type: 'url_citation',
            url_citation: { url: 'https://acme.example/about' }, // duplicate, deduped
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 },
};

describe('OpenRouterAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws when apiKey is missing', () => {
      const cfg = makeConfig('openrouter-sonar-pro', { credentials: {} });
      expect(() => new OpenRouterAdapter(cfg, sonarStatic)).toThrow(PermanentAdapterError);
    });

    it('throws when orModel is empty', () => {
      const cfg = makeConfig('openrouter-sonar-pro');
      expect(() => new OpenRouterAdapter(cfg, { orModel: '', citationStyle: 'sonar' })).toThrow(
        PermanentAdapterError
      );
    });

    it('exposes platform id and display name from config', () => {
      const cfg = makeConfig('openrouter-sonar-pro');
      const adapter = new OpenRouterAdapter(cfg, sonarStatic);
      expect(adapter.platformId).toBe('openrouter-sonar-pro');
      expect(adapter.platformName).toBe('Test openrouter-sonar-pro');
    });

    it('per-row config.orModel overrides the static default', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({
        body: { ...sonarResponse, model: 'meta-llama/llama-3.3-70b-instruct:free' },
      });
      const cfg = makeConfig('openrouter-free', {
        config: { orModel: 'meta-llama/llama-3.3-70b-instruct:free' },
      });
      const adapter = new OpenRouterAdapter(cfg, {
        orModel: 'openrouter/free',
        citationStyle: 'online',
      });

      await adapter.query('hello');

      expect(mockCreateChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'meta-llama/llama-3.3-70b-instruct:free' }),
        expect.anything()
      );
    });

    it('per-row config.citationStyle overrides the static default', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({ body: sonarResponse });
      const cfg = makeConfig('openrouter-free', {
        config: { citationStyle: 'sonar' },
      });
      const adapter = new OpenRouterAdapter(cfg, {
        orModel: 'openrouter/free',
        citationStyle: 'online',
      });

      const res = await adapter.query('hello');
      const citations = await adapter.extractCitations(res, { name: 'X', aliases: [] });

      // sonarResponse has only flat-array citations; sonar style picks them up.
      expect(citations.length).toBeGreaterThan(0);
    });

    it('ignores invalid citationStyle override and keeps the static default', () => {
      const cfg = makeConfig('openrouter-free', { config: { citationStyle: 'bogus' } });
      const adapter = new OpenRouterAdapter(cfg, sonarStatic);
      expect(adapter.platformId).toBe('openrouter-free');
      // No throw — silently keeps static default.
    });
  });

  describe('query — sonar style', () => {
    it('returns text and tokensUsed; metadata.model carries the OR slug', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({ body: sonarResponse });
      const adapter = new OpenRouterAdapter(makeConfig('openrouter-sonar-pro'), sonarStatic);

      const res = await adapter.query('what does acme do?');

      expect(res.textContent).toBe('Acme Corp leads in widgets.');
      expect(res.metadata.tokensUsed).toBe(70);
      expect(res.metadata.model).toContain('perplexity/sonar-pro');
    });

    it('extracts deduped citations from message.citations[]', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({ body: sonarResponse });
      const adapter = new OpenRouterAdapter(makeConfig('openrouter-sonar-pro'), sonarStatic);

      const res = await adapter.query('what does acme do?');
      const citations = await adapter.extractCitations(res, { name: 'Acme', aliases: [] });

      expect(citations).toEqual([
        { url: 'https://acme.example/widgets', title: '', snippet: '', position: 1 },
      ]);
    });
  });

  describe('query — online style', () => {
    it('extracts deduped url_citation annotations', async () => {
      mockCreateChatCompletion.mockResolvedValueOnce({ body: onlineResponse });
      const adapter = new OpenRouterAdapter(makeConfig('openrouter-gpt4o-online'), onlineStatic);

      const res = await adapter.query('tell me about acme');
      const citations = await adapter.extractCitations(res, { name: 'Acme', aliases: [] });

      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        url: 'https://acme.example/about',
        title: 'About Acme',
        position: 1,
      });
      expect(citations[0]?.snippet).toContain('leading');
    });

    it('falls back to flat array when annotations are absent', async () => {
      const fallbackResponse: OpenRouterChatResponse = {
        id: 'gen-or-fallback-1',
        model: 'openai/gpt-4o',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Done.',
              citations: ['https://only.example/a'],
            },
          },
        ],
      };
      mockCreateChatCompletion.mockResolvedValueOnce({ body: fallbackResponse });
      const adapter = new OpenRouterAdapter(makeConfig('openrouter-gpt4o-online'), onlineStatic);

      const res = await adapter.query('q');
      const citations = await adapter.extractCitations(res, { name: 'X', aliases: [] });

      expect(citations).toEqual([
        { url: 'https://only.example/a', title: '', snippet: '', position: 1 },
      ]);
    });
  });
});
