// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerplexityClient } from './perplexity.client';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
  AdapterError,
} from '../adapter.types';

const mockLog = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  info: vi.fn(),
} as unknown as import('pino').Logger;

const validResponse = {
  id: 'resp_abc123',
  model: 'sonar',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello world',
        citations: ['https://example.com'],
      },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const baseRequest = {
  model: 'sonar',
  messages: [{ role: 'user' as const, content: 'test prompt' }],
  stream: false as const,
};

function mockFetchResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  const headerMap = new Headers(headers);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      headers: headerMap,
    })
  );
}

describe('PerplexityClient', () => {
  let client: PerplexityClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new PerplexityClient('pplx-test-key', mockLog);
  });

  describe('createCompletion', () => {
    it('sends correct request to Perplexity API', async () => {
      mockFetchResponse(200, validResponse);

      await client.createCompletion(baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.perplexity.ai/v1/chat/completions');

      const options = fetchCall[1] as RequestInit;
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer pplx-test-key');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('sonar');
      expect(body.messages).toEqual([{ role: 'user', content: 'test prompt' }]);
      expect(body.stream).toBe(false);
    });

    it('always sets stream to false in request body', async () => {
      mockFetchResponse(200, validResponse);

      await client.createCompletion(baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string);
      expect(body.stream).toBe(false);
    });

    it('returns parsed response body and rate limits', async () => {
      mockFetchResponse(200, validResponse, {
        'x-ratelimit-remaining-requests': '49',
        'x-ratelimit-reset-requests': '2.0',
      });

      const result = await client.createCompletion(baseRequest, {
        timeoutMs: 5000,
      });

      expect(result.body.id).toBe('resp_abc123');
      expect(result.body.model).toBe('sonar');
      expect(result.body.choices[0].message.citations).toEqual(['https://example.com']);
      expect(result.rateLimits.remainingRequests).toBe(49);
      expect(result.rateLimits.resetRequests).toBe('2.0');
    });

    it('throws PermanentAdapterError on 401', async () => {
      mockFetchResponse(401, {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 400', async () => {
      mockFetchResponse(400, {
        error: {
          message: 'Bad request',
          type: 'invalid_request_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 403', async () => {
      mockFetchResponse(403, {
        error: {
          message: 'Forbidden',
          type: 'permission_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 422', async () => {
      mockFetchResponse(422, {
        error: {
          message: 'Unprocessable',
          type: 'invalid_request_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws RateLimitAdapterError on 429 with retry-after header', async () => {
      mockFetchResponse(
        429,
        {
          error: {
            message: 'Rate limited',
            type: 'rate_limit_error',
            code: null,
          },
        },
        { 'retry-after': '30' }
      );

      try {
        await client.createCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
      }
    });

    it('throws RateLimitAdapterError with default retry-after when no header', async () => {
      mockFetchResponse(429, {
        error: {
          message: 'Rate limited',
          type: 'rate_limit_error',
          code: null,
        },
      });

      try {
        await client.createCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
      }
    });

    it('throws TransientAdapterError on 500', async () => {
      mockFetchResponse(500, {
        error: {
          message: 'Server error',
          type: 'server_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on 502', async () => {
      mockFetchResponse(502, {
        error: {
          message: 'Bad gateway',
          type: 'server_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on 503', async () => {
      mockFetchResponse(503, {
        error: {
          message: 'Service unavailable',
          type: 'server_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on 504', async () => {
      mockFetchResponse(504, {
        error: {
          message: 'Gateway timeout',
          type: 'server_error',
          code: null,
        },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws AdapterError on unexpected status codes', async () => {
      mockFetchResponse(418, {
        error: { message: "I'm a teapot", type: 'unknown', code: null },
      });

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        AdapterError
      );
    });

    it('throws TransientAdapterError on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      await expect(client.createCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on abort/timeout', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(
            Object.assign(new DOMException('The operation was aborted', 'AbortError'))
          )
      );

      await expect(client.createCompletion(baseRequest, { timeoutMs: 1 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('parses x-ratelimit-reset-requests as retry-after fallback', async () => {
      mockFetchResponse(
        429,
        {
          error: {
            message: 'Rate limited',
            type: 'rate_limit_error',
            code: null,
          },
        },
        { 'x-ratelimit-reset-requests': '15' }
      );

      try {
        await client.createCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(15_000);
      }
    });
  });
});
