// ---------------------------------------------------------------------------
// SearchAPI.io SERP provider implementation.
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import type { SerpProvider } from '../aio.serp-provider';
import type { SerpSearchParams, SerpSearchResult, SerpTextBlockType } from '../aio.types';
import type {
  SearchApiAiOverview,
  SearchApiSearchResponse,
  SearchApiTextBlock,
} from './searchapi.types';

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class SearchApiProvider implements SerpProvider {
  readonly providerId = 'searchapi';
  private readonly apiKey: string;

  constructor(
    credentials: Record<string, unknown>,
    _config: Record<string, unknown>,
    private readonly log: Logger
  ) {
    const apiKey = credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError(
        'Missing required credential: apiKey for SearchAPI.io',
        'aio'
      );
    }
    this.apiKey = apiKey;
  }

  async search(query: string, params: SerpSearchParams): Promise<SerpSearchResult> {
    const url = this.buildSearchUrl(query, params);

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
      params.timeoutMs
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }

    const body = (await response.json()) as SearchApiSearchResponse;

    // Page_token two-step retrieval (D5)
    if (body.ai_overview?.page_token && !this.hasTextBlocks(body.ai_overview)) {
      return this.fetchPageToken(body, params);
    }

    return this.normalizeResponse(body);
  }

  async healthCheck(): Promise<void> {
    const url = this.buildSearchUrl('test', {});
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
      15_000
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }
  }

  // -- Private helpers --------------------------------------------------------

  private buildSearchUrl(query: string, params: SerpSearchParams): string {
    const url = new URL(`${SEARCHAPI_BASE}/search`);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    if (params.countryCode) url.searchParams.set('gl', params.countryCode);
    if (params.languageCode) url.searchParams.set('hl', params.languageCode);
    return url.toString();
  }

  private async fetchPageToken(
    initialBody: SearchApiSearchResponse,
    params: SerpSearchParams
  ): Promise<SerpSearchResult> {
    const pageToken = initialBody.ai_overview!.page_token!;
    const url = new URL(`${SEARCHAPI_BASE}/search`);
    url.searchParams.set('engine', 'google_ai_overview');
    url.searchParams.set('page_token', pageToken);
    url.searchParams.set('no_cache', 'true');

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
        params.timeoutMs
      );

      if (!response.ok) {
        // Page token expired or failed — return empty AI Overview (best-effort)
        this.log.warn('SearchAPI.io page_token follow-up failed with status %d', response.status);
        return this.normalizeResponse(initialBody);
      }

      const followUp = (await response.json()) as SearchApiSearchResponse;

      // Merge follow-up AI Overview into initial response
      const merged: SearchApiSearchResponse = {
        ...initialBody,
        ai_overview: followUp.ai_overview ?? initialBody.ai_overview,
      };

      return this.normalizeResponse(merged);
    } catch (error) {
      // Page token retrieval failure — return empty AI Overview
      this.log.warn({ err: error }, 'SearchAPI.io page_token retrieval failed');
      return this.normalizeResponse(initialBody);
    }
  }

  private hasTextBlocks(overview: SearchApiAiOverview): boolean {
    return Array.isArray(overview.text_blocks) && overview.text_blocks.length > 0;
  }

  private normalizeResponse(body: SearchApiSearchResponse): SerpSearchResult {
    const overview = body.ai_overview;
    const hasAiOverview = !!overview && this.hasTextBlocks(overview);

    if (!hasAiOverview || !overview) {
      return {
        hasAiOverview: false,
        rawResponse: body,
        requestId: body.search_metadata?.id,
      };
    }

    return {
      hasAiOverview: true,
      aiOverview: {
        textBlocks: (overview.text_blocks ?? []).map((block) => this.normalizeTextBlock(block)),
        references: (overview.references ?? []).map((ref) => ({
          title: ref.title ?? '',
          link: ref.link ?? '',
          snippet: ref.snippet ?? '',
          source: ref.source ?? '',
          index: ref.index ?? 0,
        })),
      },
      rawResponse: body,
      requestId: body.search_metadata?.id,
    };
  }

  private normalizeTextBlock(block: SearchApiTextBlock) {
    const type = this.mapBlockType(block.type);
    let text: string;

    if (block.list && block.list.length > 0) {
      text = block.list.join('\n');
    } else {
      text = block.snippet ?? '';
    }

    return {
      type,
      text,
      referenceIndexes: block.reference_indexes ?? [],
    };
  }

  private mapBlockType(type?: string): SerpTextBlockType {
    const valid: SerpTextBlockType[] = [
      'paragraph',
      'list',
      'table',
      'heading',
      'expandable',
      'comparison',
    ];
    if (type && valid.includes(type as SerpTextBlockType)) {
      return type as SerpTextBlockType;
    }
    return 'paragraph';
  }

  private handleErrorResponse(response: Response): never {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new PermanentAdapterError(`Invalid SearchAPI.io API key (HTTP ${status})`, 'aio');
    }

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('SearchAPI.io rate limit exceeded', 'aio', retryAfterMs);
    }

    if (status === 500 || status === 502 || status === 503) {
      throw new TransientAdapterError(`SearchAPI.io server error (HTTP ${status})`, 'aio');
    }

    throw new AdapterError(`SearchAPI.io request failed (HTTP ${status})`, 'aio');
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
        throw new TransientAdapterError('SearchAPI.io request timed out', 'aio');
      }
      throw new TransientAdapterError(
        `SearchAPI.io network error: ${error instanceof Error ? error.message : 'unknown'}`,
        'aio',
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
