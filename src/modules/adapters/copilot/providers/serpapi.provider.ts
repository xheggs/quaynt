// ---------------------------------------------------------------------------
// SerpAPI SERP provider implementation for Bing Copilot.
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { CopilotSerpProvider } from '../copilot.serp-provider';
import type {
  CopilotSearchParams,
  CopilotSearchResult,
  CopilotTextBlock,
  CopilotTextBlockType,
} from '../copilot.types';
import type { SerpApiCopilotResponse, SerpApiCopilotTextBlock } from './serpapi.types';

const SERPAPI_BASE = 'https://serpapi.com';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class SerpApiCopilotProvider implements CopilotSerpProvider {
  readonly providerId = 'serpapi';
  private readonly apiKey: string;

  constructor(
    credentials: Record<string, unknown>,
    _config: Record<string, unknown>,
    private readonly log: Logger
  ) {
    const apiKey = credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey for SerpAPI', 'copilot');
    }
    this.apiKey = apiKey;
  }

  async search(query: string, params: CopilotSearchParams): Promise<CopilotSearchResult> {
    const url = this.buildSearchUrl(query, params);

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
      },
      params.timeoutMs
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }

    const body = (await response.json()) as unknown;
    this.validateResponseShape(body);

    return this.normalizeResponse(body as SerpApiCopilotResponse);
  }

  async healthCheck(): Promise<void> {
    const url = this.buildSearchUrl('test', {});
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
      },
      15_000
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }
  }

  // -- Private helpers --------------------------------------------------------

  private buildSearchUrl(query: string, params: CopilotSearchParams): string {
    const url = new URL(`${SERPAPI_BASE}/search`);
    url.searchParams.set('engine', 'bing_copilot');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', this.apiKey);
    if (params.noCache) {
      url.searchParams.set('no_cache', 'true');
    }
    // Note: SerpAPI bing_copilot engine does not support locale parameters.
    return url.toString();
  }

  private normalizeResponse(body: SerpApiCopilotResponse): CopilotSearchResult {
    const hasContent =
      !!body.header || (Array.isArray(body.text_blocks) && body.text_blocks.length > 0);

    if (!hasContent) {
      return {
        hasCopilotAnswer: false,
        rawResponse: body,
        requestId: body.search_metadata?.id,
      };
    }

    return {
      hasCopilotAnswer: true,
      copilotAnswer: {
        header: body.header,
        textBlocks: (body.text_blocks ?? []).map((block) => this.normalizeTextBlock(block)),
        references: (body.references ?? []).map((ref) => ({
          index: ref.index ?? 0,
          title: ref.title ?? '',
          link: ref.link ?? '',
          snippet: ref.snippet ?? '',
          source: ref.source ?? '',
        })),
      },
      rawResponse: body,
      requestId: body.search_metadata?.id,
    };
  }

  private normalizeTextBlock(block: SerpApiCopilotTextBlock): CopilotTextBlock {
    const type = this.mapBlockType(block.type);
    let text: string;

    switch (type) {
      case 'list':
        text = block.items?.join('\n') ?? block.text ?? '';
        break;
      case 'code_block':
        text = block.code ?? block.text ?? '';
        break;
      case 'table':
        text = (block.table ?? []).map((row) => row.join('\t')).join('\n');
        if (!text) text = block.text ?? '';
        break;
      default:
        text = block.text ?? '';
        break;
    }

    return {
      type,
      text,
      referenceIndexes: block.reference_indexes ?? [],
    };
  }

  private mapBlockType(type?: string): CopilotTextBlockType {
    const valid: CopilotTextBlockType[] = ['paragraph', 'heading', 'list', 'code_block', 'table'];
    if (type && valid.includes(type as CopilotTextBlockType)) {
      return type as CopilotTextBlockType;
    }
    return 'paragraph';
  }

  private validateResponseShape(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new TransientAdapterError(
        'SerpAPI response shape changed: expected an object',
        'copilot'
      );
    }

    const obj = data as Record<string, unknown>;

    if ('text_blocks' in obj && !Array.isArray(obj.text_blocks)) {
      throw new TransientAdapterError(
        'SerpAPI response shape changed: text_blocks is not an array',
        'copilot'
      );
    }

    if ('references' in obj && !Array.isArray(obj.references)) {
      throw new TransientAdapterError(
        'SerpAPI response shape changed: references is not an array',
        'copilot'
      );
    }
  }

  private handleErrorResponse(response: Response): never {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new PermanentAdapterError(`Invalid SerpAPI API key (HTTP ${status})`, 'copilot');
    }

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('SerpAPI rate limit exceeded', 'copilot', retryAfterMs);
    }

    if (status === 500 || status === 502 || status === 503) {
      throw new TransientAdapterError(`SerpAPI server error (HTTP ${status})`, 'copilot');
    }

    throw new AdapterError(`SerpAPI request failed (HTTP ${status})`, 'copilot');
  }

  private parseRetryAfterMs(headers: Headers): number {
    const retryAfter = headers.get('Retry-After') ?? headers.get('retry-after');
    if (!retryAfter) return DEFAULT_RETRY_AFTER_MS;

    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return seconds * 1000;
    }

    return DEFAULT_RETRY_AFTER_MS;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs?: number
  ): Promise<Response> {
    if (!timeoutMs) return fetch(url, init);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TransientAdapterError('SerpAPI request timed out', 'copilot');
      }
      throw new TransientAdapterError(
        `SerpAPI network error: ${error instanceof Error ? error.message : 'unknown'}`,
        'copilot',
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
