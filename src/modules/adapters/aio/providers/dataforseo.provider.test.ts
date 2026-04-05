// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataForSeoProvider } from './dataforseo.provider';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { DataForSeoResponse } from './dataforseo.types';

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

function mockBody(overrides?: Partial<DataForSeoResponse>): DataForSeoResponse {
  return {
    tasks: [
      {
        id: 'task-123',
        status_code: 20000,
        status_message: 'Ok.',
        result: [
          {
            keyword: 'test',
            items: [
              {
                type: 'ai_overview',
                text: 'AI Overview main text',
                items: [{ type: 'paragraph', text: 'Sub paragraph text' }],
                references: [
                  {
                    title: 'Example',
                    url: 'https://example.com',
                    snippet: 'Example snippet',
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

describe('DataForSeoProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Constructor ----------------------------------------------------------

  it('throws PermanentAdapterError when username is missing', () => {
    expect(() => new DataForSeoProvider({ password: 'pass' }, {}, mockLog)).toThrow(
      PermanentAdapterError
    );
  });

  it('throws PermanentAdapterError when password is missing', () => {
    expect(() => new DataForSeoProvider({ username: 'user' }, {}, mockLog)).toThrow(
      PermanentAdapterError
    );
  });

  it('constructs successfully with valid credentials', () => {
    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    expect(provider.providerId).toBe('dataforseo');
  });

  // -- search() successful with AI Overview ---------------------------------

  it('returns normalized result with AI Overview', async () => {
    const body = mockBody();
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasAiOverview).toBe(true);
    expect(result.aiOverview?.textBlocks.length).toBeGreaterThanOrEqual(1);
    expect(result.aiOverview?.references).toHaveLength(1);
    expect(result.aiOverview?.references[0].link).toBe('https://example.com');
    expect(result.requestId).toBe('task-123');
  });

  // -- search() without AI Overview -----------------------------------------

  it('returns hasAiOverview=false when no ai_overview item', async () => {
    const body: DataForSeoResponse = {
      tasks: [
        {
          id: 'task-456',
          status_code: 20000,
          status_message: 'Ok.',
          result: [{ keyword: 'test', items: [{ type: 'organic', text: 'Regular result' }] }],
        },
      ],
    };
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasAiOverview).toBe(false);
    expect(result.aiOverview).toBeUndefined();
  });

  // -- Request body construction --------------------------------------------

  it('builds request with location_code for known country', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await provider.search('test', { countryCode: 'us', languageCode: 'en' });

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(requestBody[0].location_code).toBe(2840);
    expect(requestBody[0].language_code).toBe('en');
    expect(requestBody[0].expand_ai_overview).toBe(true);
    expect(requestBody[0].load_async_ai_overview).toBe(true);
  });

  it('maps GB to location_code 2826', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await provider.search('test', { countryCode: 'gb' });

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(requestBody[0].location_code).toBe(2826);
  });

  it('falls back to location_name for unknown country code', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await provider.search('test', { countryCode: 'za' });

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(requestBody[0].location_code).toBeUndefined();
    expect(requestBody[0].location_name).toBe('ZA');
  });

  // -- Authorization header -------------------------------------------------

  it('sends Basic authorization header', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new DataForSeoProvider(
      { username: 'myuser', password: 'mypass' },
      {},
      mockLog
    );
    await provider.search('test', {});

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const expected = `Basic ${btoa('myuser:mypass')}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(expected);
  });

  // -- Task-level error handling --------------------------------------------

  it('throws PermanentAdapterError on 40000-series task error', async () => {
    const body: DataForSeoResponse = {
      tasks: [{ id: 'task-err', status_code: 40000, status_message: 'Bad Request' }],
    };
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws TransientAdapterError on 50000-series task error', async () => {
    const body: DataForSeoResponse = {
      tasks: [{ id: 'task-err', status_code: 50000, status_message: 'Internal Error' }],
    };
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- HTTP-level error classification --------------------------------------

  it('throws PermanentAdapterError on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws RateLimitAdapterError on 429', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '45' }));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    try {
      await provider.search('test', {});
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(45_000);
    }
  });

  it('throws TransientAdapterError on 500', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 500));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- Timeout handling -----------------------------------------------------

  it('throws TransientAdapterError on timeout', async () => {
    fetchSpy.mockImplementationOnce(() => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      return Promise.reject(error);
    });

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.search('test', { timeoutMs: 1 })).rejects.toThrow(TransientAdapterError);
  });

  // -- Health check ---------------------------------------------------------

  it('completes health check successfully', async () => {
    const body = mockBody();
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.healthCheck()).resolves.toBeUndefined();
  });

  it('throws on health check auth failure', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    await expect(provider.healthCheck()).rejects.toThrow(PermanentAdapterError);
  });

  // -- Response normalization -----------------------------------------------

  it('normalizes nested sub-items into text blocks', async () => {
    const body: DataForSeoResponse = {
      tasks: [
        {
          id: 'task-norm',
          status_code: 20000,
          status_message: 'Ok.',
          result: [
            {
              keyword: 'test',
              items: [
                {
                  type: 'ai_overview',
                  items: [
                    {
                      type: 'list',
                      text: 'List header',
                      items: [{ text: 'Item A' }, { text: 'Item B' }],
                    },
                  ],
                  references: [],
                },
              ],
            },
          ],
        },
      ],
    };
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new DataForSeoProvider({ username: 'user', password: 'pass' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.aiOverview?.textBlocks[0].type).toBe('list');
    expect(result.aiOverview?.textBlocks[0].text).toContain('Item A');
    expect(result.aiOverview?.textBlocks[0].text).toContain('Item B');
  });
});
