// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchApiProvider } from './searchapi.provider';
import {
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { SearchApiSearchResponse } from './searchapi.types';

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

function mockBody(overrides?: Partial<SearchApiSearchResponse>): SearchApiSearchResponse {
  return {
    search_metadata: { id: 'req-123' },
    ai_overview: {
      text_blocks: [
        {
          type: 'paragraph',
          snippet: 'AI Overviews text content',
          reference_indexes: [0],
        },
      ],
      references: [
        {
          title: 'Example',
          link: 'https://example.com',
          snippet: 'Example snippet',
          source: 'example.com',
          index: 0,
        },
      ],
    },
    ...overrides,
  };
}

describe('SearchApiProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Constructor ----------------------------------------------------------

  it('throws PermanentAdapterError when apiKey is missing', () => {
    expect(() => new SearchApiProvider({}, {}, mockLog)).toThrow(PermanentAdapterError);
  });

  it('constructs successfully with valid apiKey', () => {
    const provider = new SearchApiProvider({ apiKey: 'test-key' }, {}, mockLog);
    expect(provider.providerId).toBe('searchapi');
  });

  // -- search() successful with AI Overview ---------------------------------

  it('returns normalized result with AI Overview', async () => {
    const body = mockBody();
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test query', {});

    expect(result.hasAiOverview).toBe(true);
    expect(result.aiOverview?.textBlocks).toHaveLength(1);
    expect(result.aiOverview?.textBlocks[0].text).toBe('AI Overviews text content');
    expect(result.aiOverview?.textBlocks[0].type).toBe('paragraph');
    expect(result.aiOverview?.references).toHaveLength(1);
    expect(result.aiOverview?.references[0].link).toBe('https://example.com');
    expect(result.requestId).toBe('req-123');
    expect(result.rawResponse).toEqual(body);
  });

  // -- search() without AI Overview -----------------------------------------

  it('returns hasAiOverview=false when no ai_overview in response', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ search_metadata: { id: 'req-456' } }));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test query', {});

    expect(result.hasAiOverview).toBe(false);
    expect(result.aiOverview).toBeUndefined();
    expect(result.requestId).toBe('req-456');
  });

  it('returns hasAiOverview=false when ai_overview has empty text_blocks', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse(mockBody({ ai_overview: { text_blocks: [], references: [] } }))
    );

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasAiOverview).toBe(false);
  });

  // -- Page token two-step retrieval ----------------------------------------

  it('handles page_token two-step retrieval', async () => {
    const initialBody: SearchApiSearchResponse = {
      search_metadata: { id: 'req-init' },
      ai_overview: {
        page_token: 'tok-abc',
        serpapi_link: 'https://searchapi.io/...',
        text_blocks: [],
      },
    };

    const followUpBody: SearchApiSearchResponse = {
      ai_overview: {
        text_blocks: [{ type: 'paragraph', snippet: 'Loaded content' }],
        references: [
          { title: 'Ref', link: 'https://ref.com', snippet: 'S', source: 'ref.com', index: 0 },
        ],
      },
    };

    fetchSpy
      .mockResolvedValueOnce(makeResponse(initialBody))
      .mockResolvedValueOnce(makeResponse(followUpBody));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasAiOverview).toBe(true);
    expect(result.aiOverview?.textBlocks[0].text).toBe('Loaded content');

    // Verify second request used google_ai_overview engine
    const secondCall = fetchSpy.mock.calls[1][0] as string;
    expect(secondCall).toContain('engine=google_ai_overview');
    expect(secondCall).toContain('page_token=tok-abc');
    expect(secondCall).toContain('no_cache=true');
  });

  it('returns empty AI Overview when page_token follow-up fails', async () => {
    const initialBody: SearchApiSearchResponse = {
      search_metadata: { id: 'req-init' },
      ai_overview: { page_token: 'tok-expired', text_blocks: [] },
    };

    fetchSpy
      .mockResolvedValueOnce(makeResponse(initialBody))
      .mockResolvedValueOnce(makeResponse({}, 500));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.hasAiOverview).toBe(false);
  });

  // -- URL construction with locale params ----------------------------------

  it('builds URL with gl and hl params from countryCode and languageCode', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await provider.search('test', { countryCode: 'us', languageCode: 'en' });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('gl=us');
    expect(url).toContain('hl=en');
    expect(url).toContain('engine=google');
    expect(url).toContain('q=test');
  });

  it('omits gl and hl when not provided', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await provider.search('test', {});

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).not.toContain('gl=');
    expect(url).not.toContain('hl=');
  });

  // -- Authorization header -------------------------------------------------

  it('sends Bearer authorization header', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SearchApiProvider({ apiKey: 'my-secret-key' }, {}, mockLog);
    await provider.search('test', {});

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer my-secret-key');
  });

  // -- Error classification -------------------------------------------------

  it('throws PermanentAdapterError on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new SearchApiProvider({ apiKey: 'bad-key' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws PermanentAdapterError on 403', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 403));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws RateLimitAdapterError on 429 with Retry-After header', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '30' }));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    try {
      await provider.search('test', {});
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
    }
  });

  it('uses default retry-after when header absent on 429', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    try {
      await provider.search('test', {});
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
    }
  });

  it('throws TransientAdapterError on 500', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 500));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError on 502', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 502));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError on 503', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 503));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.search('test', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- Response normalization -----------------------------------------------

  it('normalizes list text blocks by joining list items', async () => {
    const body = mockBody({
      ai_overview: {
        text_blocks: [
          { type: 'list', list: ['Item 1', 'Item 2', 'Item 3'], reference_indexes: [] },
        ],
        references: [],
      },
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.aiOverview?.textBlocks[0].text).toBe('Item 1\nItem 2\nItem 3');
    expect(result.aiOverview?.textBlocks[0].type).toBe('list');
  });

  it('defaults missing optional reference fields', async () => {
    const body = mockBody({
      ai_overview: {
        text_blocks: [{ type: 'paragraph', snippet: 'Text' }],
        references: [{ link: 'https://example.com' }],
      },
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    const ref = result.aiOverview!.references[0];
    expect(ref.title).toBe('');
    expect(ref.snippet).toBe('');
    expect(ref.source).toBe('');
    expect(ref.index).toBe(0);
  });

  it('maps unknown block types to paragraph', async () => {
    const body = mockBody({
      ai_overview: {
        text_blocks: [{ type: 'carousel', snippet: 'Carousel text' }],
        references: [],
      },
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    const result = await provider.search('test', {});

    expect(result.aiOverview?.textBlocks[0].type).toBe('paragraph');
  });

  // -- Timeout handling -----------------------------------------------------

  it('throws TransientAdapterError on timeout', async () => {
    fetchSpy.mockImplementationOnce(() => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      return Promise.reject(error);
    });

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.search('test', { timeoutMs: 1 })).rejects.toThrow(TransientAdapterError);
  });

  // -- Health check ---------------------------------------------------------

  it('completes health check successfully on 200', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}));

    const provider = new SearchApiProvider({ apiKey: 'key' }, {}, mockLog);
    await expect(provider.healthCheck()).resolves.toBeUndefined();
  });

  it('throws on health check failure', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new SearchApiProvider({ apiKey: 'bad-key' }, {}, mockLog);
    await expect(provider.healthCheck()).rejects.toThrow(PermanentAdapterError);
  });
});
