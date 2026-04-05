// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataForSeoCopilotProvider } from './dataforseo.provider';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { DataForSeoCopilotResponse } from './dataforseo.types';

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as import('pino').Logger;

function makeResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  } as Response;
}

function mockBody(overrides?: Partial<DataForSeoCopilotResponse>): DataForSeoCopilotResponse {
  return {
    tasks: [
      {
        id: 'task-123',
        status_code: 20000,
        status_message: 'Ok.',
        result: [
          {
            keyword: 'best CRM',
            items: [
              {
                type: 'ai_overview',
                items: [
                  {
                    type: 'ai_overview_element',
                    text: 'Copilot says this about CRM.',
                  },
                ],
                references: [
                  {
                    title: 'Example CRM',
                    url: 'https://example.com/crm',
                    text: 'A CRM tool',
                    source: 'example.com',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('DataForSeoCopilotProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Constructor ----------------------------------------------------------

  it('throws PermanentAdapterError when username is missing', () => {
    expect(() => new DataForSeoCopilotProvider({ password: 'p' }, {}, mockLog)).toThrow(
      PermanentAdapterError
    );
  });

  it('throws PermanentAdapterError when password is missing', () => {
    expect(() => new DataForSeoCopilotProvider({ username: 'u' }, {}, mockLog)).toThrow(
      PermanentAdapterError
    );
  });

  it('constructs successfully with valid credentials', () => {
    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    expect(provider.providerId).toBe('dataforseo');
  });

  // -- search() successful with Copilot answer --------------------------------

  it('returns normalized result with ai_overview item', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    const result = await provider.search('best CRM', {});

    expect(result.hasCopilotAnswer).toBe(true);
    expect(result.copilotAnswer).toBeDefined();
    expect(result.copilotAnswer!.textBlocks).toHaveLength(1);
    expect(result.copilotAnswer!.textBlocks[0].text).toBe('Copilot says this about CRM.');
    expect(result.copilotAnswer!.references).toHaveLength(1);
    expect(result.copilotAnswer!.references[0].link).toBe('https://example.com/crm');
    expect(result.requestId).toBe('task-123');
  });

  // -- search() without Copilot answer ----------------------------------------

  it('returns hasCopilotAnswer=false when no ai_overview item', async () => {
    const body = mockBody({
      tasks: [
        {
          id: 'task-456',
          status_code: 20000,
          status_message: 'Ok.',
          result: [
            {
              keyword: 'test',
              items: [{ type: 'organic', items: [], references: [] }],
            },
          ],
        },
      ],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasCopilotAnswer).toBe(false);
    expect(result.copilotAnswer).toBeUndefined();
  });

  // -- Request construction ---------------------------------------------------

  it('sends POST to bing/organic/live/advanced with Basic auth', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider(
      { username: 'user1', password: 'pass1' },
      {},
      mockLog
    );
    await provider.search('test query', {});

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/serp/bing/organic/live/advanced');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toHaveProperty(
      'Authorization',
      `Basic ${btoa('user1:pass1')}`
    );
  });

  it('includes location_code for known country codes', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await provider.search('test', { countryCode: 'us' });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body[0].location_code).toBe(2840);
  });

  it('includes location_code for GB', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await provider.search('test', { countryCode: 'gb' });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body[0].location_code).toBe(2826);
  });

  it('falls back to location_name for unmapped country codes', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await provider.search('test', { countryCode: 'za' });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body[0].location_name).toBe('ZA');
    expect(body[0].location_code).toBeUndefined();
  });

  it('includes language_code when provided', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await provider.search('test', { languageCode: 'de' });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body[0].language_code).toBe('de');
  });

  // -- Task-level error handling ----------------------------------------------

  it('throws PermanentAdapterError on 40000-series task error', async () => {
    const body = mockBody({
      tasks: [
        {
          id: 'task-err',
          status_code: 40100,
          status_message: 'Invalid request',
          result: [],
        },
      ],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws TransientAdapterError on 50000-series task error', async () => {
    const body = mockBody({
      tasks: [
        {
          id: 'task-err',
          status_code: 50000,
          status_message: 'Internal error',
          result: [],
        },
      ],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- HTTP error classification ----------------------------------------------

  it('throws PermanentAdapterError on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws PermanentAdapterError on 403', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 403));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws RateLimitAdapterError on 429', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '15' }));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);

    try {
      await provider.search('q', {});
      expect.fail('Expected RateLimitAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(15_000);
    }
  });

  it('throws TransientAdapterError on 500', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 500));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws AdapterError on unexpected status codes', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 418));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(AdapterError);
  });

  // -- Response shape validation ----------------------------------------------

  it('throws TransientAdapterError when tasks is not an array', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ tasks: 'not-array' }));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- Timeout handling -------------------------------------------------------

  it('throws TransientAdapterError on timeout', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchSpy.mockRejectedValueOnce(abortError);

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.search('q', { timeoutMs: 100 })).rejects.toThrow(TransientAdapterError);
  });

  // -- Health check -----------------------------------------------------------

  it('healthCheck succeeds on 200 with successful task', async () => {
    const body = mockBody();
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.healthCheck()).resolves.toBeUndefined();
  });

  it('healthCheck throws on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new DataForSeoCopilotProvider({ username: 'u', password: 'p' }, {}, mockLog);
    await expect(provider.healthCheck()).rejects.toThrow(PermanentAdapterError);
  });
});
