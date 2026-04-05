// ---------------------------------------------------------------------------
// DataForSEO SERP provider implementation.
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
  DataForSeoAiOverviewSubItem,
  DataForSeoItem,
  DataForSeoRequestItem,
  DataForSeoResponse,
  DataForSeoTask,
} from './dataforseo.types';
import { COUNTRY_TO_LOCATION_CODE } from './dataforseo.types';

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class DataForSeoProvider implements SerpProvider {
  readonly providerId = 'dataforseo';
  private readonly authHeader: string;

  constructor(
    credentials: Record<string, unknown>,
    _config: Record<string, unknown>,
    private readonly log: Logger
  ) {
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;

    if (!username || !password) {
      throw new PermanentAdapterError(
        'Missing required credentials: username and password for DataForSEO',
        'aio'
      );
    }

    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`;
  }

  async search(query: string, params: SerpSearchParams): Promise<SerpSearchResult> {
    const requestBody = this.buildRequestBody(query, params);

    const response = await this.fetchWithTimeout(
      `${DATAFORSEO_BASE}/serp/google/organic/live/advanced`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      params.timeoutMs
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }

    const body = (await response.json()) as DataForSeoResponse;

    const task = body.tasks?.[0];
    if (task) {
      this.handleTaskError(task);
    }

    return this.normalizeResponse(body);
  }

  async healthCheck(): Promise<void> {
    const requestBody = this.buildRequestBody('test', {});

    const response = await this.fetchWithTimeout(
      `${DATAFORSEO_BASE}/serp/google/organic/live/advanced`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      15_000
    );

    if (!response.ok) {
      this.handleErrorResponse(response);
    }

    const body = (await response.json()) as DataForSeoResponse;
    const task = body.tasks?.[0];
    if (task) {
      this.handleTaskError(task);
    }
  }

  // -- Private helpers --------------------------------------------------------

  private buildRequestBody(query: string, params: SerpSearchParams): DataForSeoRequestItem[] {
    const item: DataForSeoRequestItem = {
      keyword: query,
      expand_ai_overview: true,
      load_async_ai_overview: true,
    };

    if (params.countryCode) {
      const code = params.countryCode.toUpperCase();
      const locationCode = COUNTRY_TO_LOCATION_CODE[code];
      if (locationCode) {
        item.location_code = locationCode;
      } else {
        // Fallback to location_name for unmapped countries
        item.location_name = code;
      }
    }

    if (params.languageCode) {
      item.language_code = params.languageCode;
    }

    return [item];
  }

  private normalizeResponse(body: DataForSeoResponse): SerpSearchResult {
    const task = body.tasks?.[0];
    const items = task?.result?.[0]?.items;
    const aiOverviewItem = items?.find((item) => item.type === 'ai_overview');

    if (!aiOverviewItem) {
      return {
        hasAiOverview: false,
        rawResponse: body,
        requestId: task?.id,
      };
    }

    const textBlocks = this.extractTextBlocks(aiOverviewItem);
    const references = (aiOverviewItem.references ?? []).map((ref, index) => ({
      title: ref.title ?? '',
      link: ref.url ?? '',
      snippet: ref.snippet ?? '',
      source: ref.source ?? '',
      index,
    }));

    return {
      hasAiOverview: true,
      aiOverview: { textBlocks, references },
      rawResponse: body,
      requestId: task?.id,
    };
  }

  private extractTextBlocks(item: DataForSeoItem) {
    const blocks: { type: SerpTextBlockType; text: string; referenceIndexes: number[] }[] = [];

    if (item.text) {
      blocks.push({ type: 'paragraph', text: item.text, referenceIndexes: [] });
    }

    if (item.items) {
      for (const sub of item.items) {
        blocks.push(this.normalizeSubItem(sub));
      }
    }

    return blocks;
  }

  private normalizeSubItem(sub: DataForSeoAiOverviewSubItem) {
    const type = this.mapBlockType(sub.type);
    let text = sub.text ?? '';

    // If sub-item has nested items (e.g., list), join them
    if (sub.items && sub.items.length > 0) {
      const nestedTexts = sub.items.map((nested) => nested.text ?? '').filter(Boolean);
      if (nestedTexts.length > 0) {
        text = text ? `${text}\n${nestedTexts.join('\n')}` : nestedTexts.join('\n');
      }
    }

    return { type, text, referenceIndexes: [] };
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
      throw new PermanentAdapterError(`Invalid DataForSEO credentials (HTTP ${status})`, 'aio');
    }

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('DataForSEO rate limit exceeded', 'aio', retryAfterMs);
    }

    if (status === 500 || status === 502 || status === 503) {
      throw new TransientAdapterError(`DataForSEO server error (HTTP ${status})`, 'aio');
    }

    throw new AdapterError(`DataForSEO request failed (HTTP ${status})`, 'aio');
  }

  private handleTaskError(task: DataForSeoTask): void {
    const code = task.status_code;

    // 20000 = success
    if (code >= 20000 && code < 30000) return;

    if (code >= 40000 && code < 50000) {
      throw new PermanentAdapterError(
        `DataForSEO task error: ${task.status_message} (${code})`,
        'aio'
      );
    }

    if (code >= 50000) {
      throw new TransientAdapterError(
        `DataForSEO task error: ${task.status_message} (${code})`,
        'aio'
      );
    }
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
        throw new TransientAdapterError('DataForSEO request timed out', 'aio');
      }
      throw new TransientAdapterError(
        `DataForSEO network error: ${error instanceof Error ? error.message : 'unknown'}`,
        'aio',
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
