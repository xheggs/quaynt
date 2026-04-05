// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeClient, ANTHROPIC_API_BASE, ANTHROPIC_API_VERSION } from './claude.client';
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
  id: 'msg_abc123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'Hello world',
    },
  ],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
};

const baseRequest = {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 4096,
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

describe('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new ClaudeClient('sk-ant-test-key', mockLog);
  });

  describe('sendMessage', () => {
    it('sends correct request to Anthropic API', async () => {
      mockFetchResponse(200, validResponse);

      await client.sendMessage(baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(`${ANTHROPIC_API_BASE}/v1/messages`);

      const options = fetchCall[1] as RequestInit;
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('sk-ant-test-key');
      expect(headers['anthropic-version']).toBe(ANTHROPIC_API_VERSION);
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('claude-haiku-4-5-20251001');
      expect(body.max_tokens).toBe(4096);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('test prompt');
    });

    it('returns parsed response body and rate limits', async () => {
      mockFetchResponse(200, validResponse, {
        'anthropic-ratelimit-requests-limit': '50',
        'anthropic-ratelimit-requests-remaining': '49',
        'anthropic-ratelimit-requests-reset': '2026-04-05T12:00:00Z',
        'anthropic-ratelimit-tokens-limit': '100000',
        'anthropic-ratelimit-tokens-remaining': '99000',
        'anthropic-ratelimit-tokens-reset': '2026-04-05T12:00:00Z',
      });

      const result = await client.sendMessage(baseRequest, { timeoutMs: 5000 });

      expect(result.body.id).toBe('msg_abc123');
      expect(result.body.model).toBe('claude-haiku-4-5-20251001');
      expect(result.rateLimits.requestsLimit).toBe(50);
      expect(result.rateLimits.requestsRemaining).toBe(49);
      expect(result.rateLimits.requestsReset).toBe('2026-04-05T12:00:00Z');
      expect(result.rateLimits.tokensLimit).toBe(100000);
      expect(result.rateLimits.tokensRemaining).toBe(99000);
      expect(result.rateLimits.tokensReset).toBe('2026-04-05T12:00:00Z');
    });

    it('parses all 12 rate limit headers', async () => {
      mockFetchResponse(200, validResponse, {
        'anthropic-ratelimit-requests-limit': '50',
        'anthropic-ratelimit-requests-remaining': '49',
        'anthropic-ratelimit-requests-reset': '2026-04-05T12:00:00Z',
        'anthropic-ratelimit-tokens-limit': '100000',
        'anthropic-ratelimit-tokens-remaining': '99000',
        'anthropic-ratelimit-tokens-reset': '2026-04-05T12:01:00Z',
        'anthropic-ratelimit-input-tokens-limit': '80000',
        'anthropic-ratelimit-input-tokens-remaining': '79000',
        'anthropic-ratelimit-input-tokens-reset': '2026-04-05T12:02:00Z',
        'anthropic-ratelimit-output-tokens-limit': '20000',
        'anthropic-ratelimit-output-tokens-remaining': '19000',
        'anthropic-ratelimit-output-tokens-reset': '2026-04-05T12:03:00Z',
      });

      const result = await client.sendMessage(baseRequest, { timeoutMs: 5000 });

      expect(result.rateLimits.requestsLimit).toBe(50);
      expect(result.rateLimits.requestsRemaining).toBe(49);
      expect(result.rateLimits.requestsReset).toBe('2026-04-05T12:00:00Z');
      expect(result.rateLimits.tokensLimit).toBe(100000);
      expect(result.rateLimits.tokensRemaining).toBe(99000);
      expect(result.rateLimits.tokensReset).toBe('2026-04-05T12:01:00Z');
      expect(result.rateLimits.inputTokensLimit).toBe(80000);
      expect(result.rateLimits.inputTokensRemaining).toBe(79000);
      expect(result.rateLimits.inputTokensReset).toBe('2026-04-05T12:02:00Z');
      expect(result.rateLimits.outputTokensLimit).toBe(20000);
      expect(result.rateLimits.outputTokensRemaining).toBe(19000);
      expect(result.rateLimits.outputTokensReset).toBe('2026-04-05T12:03:00Z');
    });

    it('returns empty rate limits when no headers present', async () => {
      mockFetchResponse(200, validResponse);

      const result = await client.sendMessage(baseRequest, { timeoutMs: 5000 });

      expect(result.rateLimits).toEqual({});
    });

    it('throws PermanentAdapterError on 400', async () => {
      mockFetchResponse(400, {
        type: 'error',
        error: { type: 'invalid_request_error', message: 'Bad request' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 401', async () => {
      mockFetchResponse(401, {
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 402', async () => {
      mockFetchResponse(402, {
        type: 'error',
        error: { type: 'billing_error', message: 'Billing error' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 403', async () => {
      mockFetchResponse(403, {
        type: 'error',
        error: { type: 'permission_error', message: 'Permission denied' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 404', async () => {
      mockFetchResponse(404, {
        type: 'error',
        error: { type: 'not_found_error', message: 'Not found' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 413', async () => {
      mockFetchResponse(413, {
        type: 'error',
        error: { type: 'request_too_large', message: 'Request too large' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws RateLimitAdapterError on 429 with retry-after header', async () => {
      mockFetchResponse(
        429,
        {
          type: 'error',
          error: { type: 'rate_limit_error', message: 'Rate limited' },
        },
        { 'retry-after': '30' }
      );

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
      }
    });

    it('throws RateLimitAdapterError with default retry-after when no header', async () => {
      mockFetchResponse(429, {
        type: 'error',
        error: { type: 'rate_limit_error', message: 'Rate limited' },
      });

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
      }
    });

    it('throws TransientAdapterError on 529 (overloaded), NOT RateLimitAdapterError', async () => {
      mockFetchResponse(529, {
        type: 'error',
        error: { type: 'overloaded_error', message: 'API is overloaded' },
      });

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TransientAdapterError);
        expect(error).not.toBeInstanceOf(RateLimitAdapterError);
      }
    });

    it('throws TransientAdapterError on 500', async () => {
      mockFetchResponse(500, {
        type: 'error',
        error: { type: 'api_error', message: 'Server error' },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws AdapterError on unexpected status codes', async () => {
      mockFetchResponse(418, {
        type: 'error',
        error: { type: 'unknown', message: "I'm a teapot" },
      });

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        AdapterError
      );
    });

    it('includes request_id in error message when present', async () => {
      mockFetchResponse(400, {
        type: 'error',
        error: { type: 'invalid_request_error', message: 'Bad request' },
        request_id: 'req_123abc',
      });

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('req_123abc');
      }
    });

    it('handles unparseable error response body', async () => {
      const headerMap = new Headers();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.reject(new Error('invalid json')),
          headers: headerMap,
        })
      );

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws TransientAdapterError on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      await expect(client.sendMessage(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
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

      await expect(client.sendMessage(baseRequest, { timeoutMs: 1 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('includes timeout duration in timeout error message', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(
            Object.assign(new DOMException('The operation was aborted', 'AbortError'))
          )
      );

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('5000ms');
      }
    });

    it('parses fractional retry-after header', async () => {
      mockFetchResponse(
        429,
        {
          type: 'error',
          error: { type: 'rate_limit_error', message: 'Rate limited' },
        },
        { 'retry-after': '1.5' }
      );

      try {
        await client.sendMessage(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(1500);
      }
    });
  });
});
