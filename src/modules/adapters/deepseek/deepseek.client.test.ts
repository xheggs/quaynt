// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepSeekClient, DEEPSEEK_API_BASE } from './deepseek.client';
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
  id: 'chatcmpl-deepseek-123',
  object: 'chat.completion',
  model: 'deepseek-chat',
  created: 1700000000,
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'Hello world' },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const baseRequest = {
  model: 'deepseek-chat',
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

describe('DeepSeekClient', () => {
  let client: DeepSeekClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new DeepSeekClient('sk-deepseek-test-key', mockLog);
  });

  describe('createChatCompletion', () => {
    it('sends correct request to DeepSeek API', async () => {
      mockFetchResponse(200, validResponse);

      await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(`${DEEPSEEK_API_BASE}/chat/completions`);

      const options = fetchCall[1] as RequestInit;
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-deepseek-test-key');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('deepseek-chat');
      expect(body.messages).toEqual([{ role: 'user', content: 'test prompt' }]);
      expect(body.stream).toBe(false);
    });

    it('returns parsed response body', async () => {
      mockFetchResponse(200, validResponse);

      const result = await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });

      expect(result.body.id).toBe('chatcmpl-deepseek-123');
      expect(result.body.model).toBe('deepseek-chat');
      expect(result.body.choices[0].message.content).toBe('Hello world');
      expect(result.body.usage.total_tokens).toBe(15);
    });

    it('throws PermanentAdapterError on 400', async () => {
      mockFetchResponse(400, {
        error: { message: 'Bad request', type: 'invalid_request_error' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 401', async () => {
      mockFetchResponse(401, {
        error: { message: 'Invalid API key', type: 'authentication_error' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 402 with insufficient balance context', async () => {
      mockFetchResponse(402, {
        error: { message: 'Insufficient balance', type: 'billing_error' },
      });

      try {
        await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PermanentAdapterError);
        expect((error as PermanentAdapterError).message).toContain('Insufficient balance');
      }
    });

    it('throws PermanentAdapterError on 422', async () => {
      mockFetchResponse(422, {
        error: { message: 'Invalid parameters', type: 'invalid_request_error' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws RateLimitAdapterError on 429 with default retry-after', async () => {
      mockFetchResponse(429, {
        error: { message: 'Rate limited', type: 'rate_limit_error' },
      });

      try {
        await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
      }
    });

    it('throws RateLimitAdapterError on 429 with retry-after header', async () => {
      mockFetchResponse(
        429,
        { error: { message: 'Rate limited', type: 'rate_limit_error' } },
        { 'retry-after': '30' }
      );

      try {
        await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
      }
    });

    it('throws TransientAdapterError on 500', async () => {
      mockFetchResponse(500, {
        error: { message: 'Server error', type: 'server_error' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on 503', async () => {
      mockFetchResponse(503, {
        error: { message: 'Service unavailable', type: 'server_error' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws AdapterError on unexpected status codes', async () => {
      mockFetchResponse(418, {
        error: { message: "I'm a teapot", type: 'unknown' },
      });

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        AdapterError
      );
    });

    it('throws TransientAdapterError on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
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

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 1 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('parses error message from response body', async () => {
      mockFetchResponse(401, {
        error: { message: 'API key is invalid or expired', type: 'authentication_error' },
      });

      try {
        await client.createChatCompletion(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as PermanentAdapterError).message).toContain('API key is invalid or expired');
      }
    });

    it('handles unparseable error body gracefully', async () => {
      const headerMap = new Headers();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('not JSON')),
          headers: headerMap,
        })
      );

      await expect(client.createChatCompletion(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });
  });
});
