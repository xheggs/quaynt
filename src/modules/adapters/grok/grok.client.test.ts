// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrokClient, XAI_API_BASE } from './grok.client';
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
  id: 'resp_grok_123',
  model: 'grok-4-1-fast-non-reasoning',
  output: [
    {
      type: 'message',
      id: 'msg_1',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: 'Hello world',
          annotations: [],
        },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
};

const baseRequest = {
  model: 'grok-4-1-fast-non-reasoning',
  input: [{ role: 'user' as const, content: 'test prompt' }],
  store: false,
  stream: false,
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

describe('GrokClient', () => {
  let client: GrokClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new GrokClient('xai-test-key', mockLog);
  });

  describe('createResponse', () => {
    it('sends correct request to xAI API', async () => {
      mockFetchResponse(200, validResponse);

      await client.createResponse(baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(`${XAI_API_BASE}/v1/responses`);

      const options = fetchCall[1] as RequestInit;
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer xai-test-key');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('grok-4-1-fast-non-reasoning');
      expect(body.input).toEqual([{ role: 'user', content: 'test prompt' }]);
      expect(body.store).toBe(false);
      expect(body.stream).toBe(false);
    });

    it('returns parsed response body and rate limits', async () => {
      mockFetchResponse(200, validResponse, {
        'x-ratelimit-remaining-requests': '59',
        'x-ratelimit-reset-requests': '1.5',
        'x-ratelimit-remaining-tokens': '9000',
        'x-ratelimit-reset-tokens': '30',
      });

      const result = await client.createResponse(baseRequest, { timeoutMs: 5000 });

      expect(result.body.id).toBe('resp_grok_123');
      expect(result.body.model).toBe('grok-4-1-fast-non-reasoning');
      expect(result.rateLimits.remainingRequests).toBe(59);
      expect(result.rateLimits.resetRequests).toBe('1.5');
      expect(result.rateLimits.remainingTokens).toBe(9000);
      expect(result.rateLimits.resetTokens).toBe('30');
    });

    it('throws PermanentAdapterError on 401', async () => {
      mockFetchResponse(401, {
        error: { message: 'Invalid API key', type: 'invalid_request_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 400', async () => {
      mockFetchResponse(400, {
        error: { message: 'Bad request', type: 'invalid_request_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 403', async () => {
      mockFetchResponse(403, {
        error: { message: 'Forbidden', type: 'permission_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 404', async () => {
      mockFetchResponse(404, {
        error: { message: 'Not found', type: 'not_found_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws PermanentAdapterError on 422', async () => {
      mockFetchResponse(422, {
        error: { message: 'Unprocessable', type: 'invalid_request_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        PermanentAdapterError
      );
    });

    it('throws RateLimitAdapterError on 429 with retry-after header', async () => {
      mockFetchResponse(
        429,
        { error: { message: 'Rate limited', type: 'rate_limit_error', code: null } },
        { 'retry-after': '30' }
      );

      try {
        await client.createResponse(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
      }
    });

    it('throws RateLimitAdapterError with default retry-after when no header', async () => {
      mockFetchResponse(429, {
        error: { message: 'Rate limited', type: 'rate_limit_error', code: null },
      });

      try {
        await client.createResponse(baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
      }
    });

    it('throws TransientAdapterError on 500', async () => {
      mockFetchResponse(500, {
        error: { message: 'Server error', type: 'server_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws TransientAdapterError on 503', async () => {
      mockFetchResponse(503, {
        error: { message: 'Service unavailable', type: 'server_error', code: null },
      });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        TransientAdapterError
      );
    });

    it('throws AdapterError on unexpected status codes', async () => {
      mockFetchResponse(418, { error: { message: "I'm a teapot", type: 'unknown', code: null } });

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
        AdapterError
      );
    });

    it('throws TransientAdapterError on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      await expect(client.createResponse(baseRequest, { timeoutMs: 5000 })).rejects.toThrow(
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

      await expect(client.createResponse(baseRequest, { timeoutMs: 1 })).rejects.toThrow(
        TransientAdapterError
      );
    });
  });
});
