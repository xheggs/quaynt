// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SerpApiCopilotProvider } from './serpapi.provider';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { SerpApiCopilotResponse } from './serpapi.types';

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

function mockBody(overrides?: Partial<SerpApiCopilotResponse>): SerpApiCopilotResponse {
  return {
    search_metadata: { id: 'req-copilot-123' },
    header: 'Microsoft Copilot says hello',
    text_blocks: [
      {
        type: 'paragraph',
        text: 'This is a Copilot paragraph.',
        reference_indexes: [1],
      },
    ],
    references: [
      {
        index: 1,
        title: 'Example',
        link: 'https://example.com',
        snippet: 'Example snippet',
        source: 'example.com',
      },
    ],
    ...overrides,
  };
}

describe('SerpApiCopilotProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Constructor ----------------------------------------------------------

  it('throws PermanentAdapterError when apiKey is missing', () => {
    expect(() => new SerpApiCopilotProvider({}, {}, mockLog)).toThrow(PermanentAdapterError);
  });

  it('constructs successfully with valid apiKey', () => {
    const provider = new SerpApiCopilotProvider({ apiKey: 'test-key' }, {}, mockLog);
    expect(provider.providerId).toBe('serpapi');
  });

  // -- search() successful with Copilot answer --------------------------------

  it('returns normalized result with Copilot answer', async () => {
    const body = mockBody();
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('best CRM', {});

    expect(result.hasCopilotAnswer).toBe(true);
    expect(result.copilotAnswer).toBeDefined();
    expect(result.copilotAnswer!.header).toBe('Microsoft Copilot says hello');
    expect(result.copilotAnswer!.textBlocks).toHaveLength(1);
    expect(result.copilotAnswer!.textBlocks[0].type).toBe('paragraph');
    expect(result.copilotAnswer!.textBlocks[0].text).toBe('This is a Copilot paragraph.');
    expect(result.copilotAnswer!.references).toHaveLength(1);
    expect(result.copilotAnswer!.references[0].link).toBe('https://example.com');
    expect(result.requestId).toBe('req-copilot-123');
  });

  // -- search() without Copilot answer ----------------------------------------

  it('returns hasCopilotAnswer=false when no header or text_blocks', async () => {
    const body = mockBody({ header: undefined, text_blocks: [] });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.hasCopilotAnswer).toBe(false);
    expect(result.copilotAnswer).toBeUndefined();
  });

  it('returns hasCopilotAnswer=true when header exists but no text_blocks', async () => {
    const body = mockBody({ text_blocks: [] });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.hasCopilotAnswer).toBe(true);
    expect(result.copilotAnswer!.header).toBe('Microsoft Copilot says hello');
  });

  // -- Text block normalization -----------------------------------------------

  it('normalizes list text blocks by joining items', async () => {
    const body = mockBody({
      text_blocks: [{ type: 'list', items: ['Item 1', 'Item 2', 'Item 3'], reference_indexes: [] }],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.copilotAnswer!.textBlocks[0].type).toBe('list');
    expect(result.copilotAnswer!.textBlocks[0].text).toBe('Item 1\nItem 2\nItem 3');
  });

  it('normalizes code_block by using code field', async () => {
    const body = mockBody({
      text_blocks: [
        {
          type: 'code_block',
          code: 'console.log("hello")',
          language: 'javascript',
          reference_indexes: [],
        },
      ],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.copilotAnswer!.textBlocks[0].type).toBe('code_block');
    expect(result.copilotAnswer!.textBlocks[0].text).toBe('console.log("hello")');
  });

  it('normalizes table text blocks by joining rows', async () => {
    const body = mockBody({
      text_blocks: [
        {
          type: 'table',
          headers: ['Name', 'Value'],
          table: [
            ['A', '1'],
            ['B', '2'],
          ],
          reference_indexes: [],
        },
      ],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.copilotAnswer!.textBlocks[0].type).toBe('table');
    expect(result.copilotAnswer!.textBlocks[0].text).toBe('A\t1\nB\t2');
  });

  it('falls back to paragraph for unknown block types', async () => {
    const body = mockBody({
      text_blocks: [{ type: 'unknown_widget', text: 'Some text', reference_indexes: [] }],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    expect(result.copilotAnswer!.textBlocks[0].type).toBe('paragraph');
  });

  // -- Reference normalization ------------------------------------------------

  it('normalizes references with safe defaults for missing fields', async () => {
    const body = mockBody({
      references: [{ link: 'https://example.com' }],
    });
    fetchSpy.mockResolvedValueOnce(makeResponse(body));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    const result = await provider.search('query', {});

    const ref = result.copilotAnswer!.references[0];
    expect(ref.title).toBe('');
    expect(ref.snippet).toBe('');
    expect(ref.source).toBe('');
    expect(ref.index).toBe(0);
  });

  // -- URL construction -------------------------------------------------------

  it('sends request to bing_copilot engine with api_key param', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SerpApiCopilotProvider({ apiKey: 'my-secret' }, {}, mockLog);
    await provider.search('test query', {});

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('engine=bing_copilot');
    expect(url).toContain('api_key=my-secret');
    expect(url).toContain('q=test+query');
  });

  it('adds no_cache=true when noCache is enabled', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await provider.search('query', { noCache: true });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('no_cache=true');
  });

  it('does not add no_cache when noCache is false', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(mockBody()));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await provider.search('query', { noCache: false });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).not.toContain('no_cache');
  });

  // -- Error classification ---------------------------------------------------

  it('throws PermanentAdapterError on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws PermanentAdapterError on 403', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 403));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(PermanentAdapterError);
  });

  it('throws RateLimitAdapterError on 429', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '30' }));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);

    try {
      await provider.search('q', {});
      expect.fail('Expected RateLimitAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(30_000);
    }
  });

  it('uses default retry-after when header is absent on 429', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 429));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);

    try {
      await provider.search('q', {});
      expect.fail('Expected RateLimitAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitAdapterError);
      expect((error as RateLimitAdapterError).retryAfterMs).toBe(60_000);
    }
  });

  it('throws TransientAdapterError on 500', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 500));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError on 502', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 502));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError on 503', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 503));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws AdapterError on unexpected status codes', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 418));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(AdapterError);
  });

  // -- Response shape validation ----------------------------------------------

  it('throws TransientAdapterError when text_blocks is not an array', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ text_blocks: 'not-array' }));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError when references is not an array', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ references: 'not-array' }));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', {})).rejects.toThrow(TransientAdapterError);
  });

  // -- Timeout handling -------------------------------------------------------

  it('throws TransientAdapterError on timeout', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchSpy.mockRejectedValueOnce(abortError);

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', { timeoutMs: 100 })).rejects.toThrow(TransientAdapterError);
  });

  it('throws TransientAdapterError on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.search('q', { timeoutMs: 100 })).rejects.toThrow(TransientAdapterError);
  });

  // -- Health check -----------------------------------------------------------

  it('healthCheck succeeds on 200', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.healthCheck()).resolves.toBeUndefined();
  });

  it('healthCheck throws on 401', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

    const provider = new SerpApiCopilotProvider({ apiKey: 'k' }, {}, mockLog);
    await expect(provider.healthCheck()).rejects.toThrow(PermanentAdapterError);
  });
});
