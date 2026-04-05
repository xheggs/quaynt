// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from './gemini.client';
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
  candidates: [
    {
      content: {
        role: 'model',
        parts: [{ text: 'Hello world' }],
      },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    totalTokenCount: 15,
  },
  modelVersion: 'gemini-2.5-flash',
};

const baseRequest = {
  contents: [{ role: 'user' as const, parts: [{ text: 'test prompt' }] }],
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

describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new GeminiClient('test-api-key', 'v1beta', mockLog);
  });

  describe('generateContent', () => {
    it('sends correct request to Gemini API', async () => {
      mockFetchResponse(200, validResponse);

      await client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      );

      const options = fetchCall[1] as RequestInit;
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('test-api-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('includes model and apiVersion in URL', async () => {
      mockFetchResponse(200, validResponse);
      const customClient = new GeminiClient('key', 'v1', mockLog);

      await customClient.generateContent('gemini-2.5-pro', baseRequest, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(
        'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent'
      );
    });

    it('returns parsed response body', async () => {
      mockFetchResponse(200, validResponse);

      const result = await client.generateContent('gemini-2.5-flash', baseRequest, {
        timeoutMs: 5000,
      });

      expect(result.body.candidates?.[0].content?.parts[0].text).toBe('Hello world');
      expect(result.body.usageMetadata?.totalTokenCount).toBe(15);
      expect(result.body.modelVersion).toBe('gemini-2.5-flash');
    });

    it('throws PermanentAdapterError on 400', async () => {
      mockFetchResponse(400, {
        error: { code: 400, message: 'Invalid argument', status: 'INVALID_ARGUMENT' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError on 403', async () => {
      mockFetchResponse(403, {
        error: { code: 403, message: 'Permission denied', status: 'PERMISSION_DENIED' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(PermanentAdapterError);
    });

    it('throws PermanentAdapterError on 404', async () => {
      mockFetchResponse(404, {
        error: { code: 404, message: 'Model not found', status: 'NOT_FOUND' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(PermanentAdapterError);
    });

    it('throws RateLimitAdapterError on 429 with Retry-After header', async () => {
      mockFetchResponse(
        429,
        {
          error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' },
        },
        { 'retry-after': '30' }
      );

      try {
        await client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
      }
    });

    it('throws RateLimitAdapterError with default retry-after when no header', async () => {
      mockFetchResponse(429, {
        error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' },
      });

      try {
        await client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitAdapterError);
        expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
      }
    });

    it('throws TransientAdapterError on 500', async () => {
      mockFetchResponse(500, {
        error: { code: 500, message: 'Internal error', status: 'INTERNAL' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(TransientAdapterError);
    });

    it('throws TransientAdapterError on 503', async () => {
      mockFetchResponse(503, {
        error: { code: 503, message: 'Unavailable', status: 'UNAVAILABLE' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(TransientAdapterError);
    });

    it('throws TransientAdapterError on 504', async () => {
      mockFetchResponse(504, {
        error: { code: 504, message: 'Deadline exceeded', status: 'DEADLINE_EXCEEDED' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(TransientAdapterError);
    });

    it('throws AdapterError on unexpected status codes', async () => {
      mockFetchResponse(418, {
        error: { code: 418, message: "I'm a teapot", status: 'UNKNOWN' },
      });

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(AdapterError);
    });

    it('includes error message from response body', async () => {
      mockFetchResponse(400, {
        error: {
          code: 400,
          message: 'Model does not support grounding',
          status: 'INVALID_ARGUMENT',
        },
      });

      try {
        await client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PermanentAdapterError);
        expect((error as PermanentAdapterError).message).toContain(
          'Model does not support grounding'
        );
      }
    });

    it('handles malformed error response body gracefully', async () => {
      const headerMap = new Headers();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.reject(new Error('Invalid JSON')),
          headers: headerMap,
        })
      );

      try {
        await client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PermanentAdapterError);
        expect((error as PermanentAdapterError).message).toContain('HTTP 400');
      }
    });

    it('throws TransientAdapterError on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 5000 })
      ).rejects.toThrow(TransientAdapterError);
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

      await expect(
        client.generateContent('gemini-2.5-flash', baseRequest, { timeoutMs: 1 })
      ).rejects.toThrow(TransientAdapterError);
    });

    it('sends request body as JSON', async () => {
      mockFetchResponse(200, validResponse);

      const request = {
        contents: [{ role: 'user' as const, parts: [{ text: 'hello' }] }],
        tools: [{ google_search: {} as Record<string, never> }],
      };

      await client.generateContent('gemini-2.5-flash', request, { timeoutMs: 5000 });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string);
      expect(body.contents[0].parts[0].text).toBe('hello');
      expect(body.tools[0]).toEqual({ google_search: {} });
    });
  });
});
