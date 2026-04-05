// ---------------------------------------------------------------------------
// DataForSEO SERP provider implementation for Bing Organic (Copilot data).
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../../adapter.types';
import { COUNTRY_TO_LOCATION_CODE } from '../../serp/location-codes';
import type { CopilotSerpProvider } from '../copilot.serp-provider';
import type {
  CopilotSearchParams,
  CopilotSearchResult,
  CopilotTextBlockType,
} from '../copilot.types';
import type {
  DataForSeoCopilotItem,
  DataForSeoCopilotRequestItem,
  DataForSeoCopilotResponse,
  DataForSeoCopilotTask,
} from './dataforseo.types';

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class DataForSeoCopilotProvider implements CopilotSerpProvider {
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
        'copilot'
      );
    }

    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`;
  }

  async search(query: string, params: CopilotSearchParams): Promise<CopilotSearchResult> {
    const requestBody = this.buildRequestBody(query, params);

    const response = await this.fetchWithTimeout(
      `${DATAFORSEO_BASE}/serp/bing/organic/live/advanced`,
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

    const body = (await response.json()) as unknown;
    this.validateResponseShape(body);

    const typed = body as DataForSeoCopilotResponse;
    const task = typed.tasks?.[0];
    if (task) {
      this.handleTaskError(task);
    }

    return this.normalizeResponse(typed);
  }

  async healthCheck(): Promise<void> {
    const requestBody = this.buildRequestBody('test', {});

    const response = await this.fetchWithTimeout(
      `${DATAFORSEO_BASE}/serp/bing/organic/live/advanced`,
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

    const body = (await response.json()) as DataForSeoCopilotResponse;
    const task = body.tasks?.[0];
    if (task) {
      this.handleTaskError(task);
    }
  }

  // -- Private helpers --------------------------------------------------------

  private buildRequestBody(
    query: string,
    params: CopilotSearchParams
  ): DataForSeoCopilotRequestItem[] {
    const item: DataForSeoCopilotRequestItem = {
      keyword: query,
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

  private normalizeResponse(body: DataForSeoCopilotResponse): CopilotSearchResult {
    const task = body.tasks?.[0];
    const items = task?.result?.[0]?.items;
    const aiOverviewItem = items?.find((item) => item.type === 'ai_overview');

    if (!aiOverviewItem) {
      return {
        hasCopilotAnswer: false,
        rawResponse: body,
        requestId: task?.id,
      };
    }

    const textBlocks = this.extractTextBlocks(aiOverviewItem);
    const references = this.extractReferences(aiOverviewItem);

    return {
      hasCopilotAnswer: true,
      copilotAnswer: { textBlocks, references },
      rawResponse: body,
      requestId: task?.id,
    };
  }

  private extractTextBlocks(item: DataForSeoCopilotItem) {
    const blocks: { type: CopilotTextBlockType; text: string; referenceIndexes: number[] }[] = [];

    if (item.items) {
      for (const sub of item.items) {
        if (sub.type === 'ai_overview_element' && sub.text) {
          blocks.push({ type: 'paragraph', text: sub.text, referenceIndexes: [] });
        }
      }
    }

    return blocks;
  }

  private extractReferences(item: DataForSeoCopilotItem) {
    const references: {
      index: number;
      title: string;
      link: string;
      snippet: string;
      source: string;
    }[] = [];

    // Top-level references
    if (item.references) {
      for (let i = 0; i < item.references.length; i++) {
        const ref = item.references[i];
        references.push({
          index: i + 1,
          title: ref.title ?? '',
          link: ref.url ?? '',
          snippet: ref.text ?? '',
          source: ref.source ?? ref.domain ?? '',
        });
      }
    }

    // References nested within ai_overview_element sub-items
    if (item.items) {
      for (const sub of item.items) {
        if (sub.type === 'ai_overview_reference' || sub.references) {
          const subRefs = sub.references ?? [];
          for (const ref of subRefs) {
            references.push({
              index: references.length + 1,
              title: ref.title ?? '',
              link: ref.url ?? '',
              snippet: ref.text ?? '',
              source: ref.source ?? ref.domain ?? '',
            });
          }
        }
      }
    }

    return references;
  }

  private validateResponseShape(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new TransientAdapterError(
        'DataForSEO response shape changed: expected an object',
        'copilot'
      );
    }

    const obj = data as Record<string, unknown>;

    if ('tasks' in obj && !Array.isArray(obj.tasks)) {
      throw new TransientAdapterError(
        'DataForSEO response shape changed: tasks is not an array',
        'copilot'
      );
    }
  }

  private handleErrorResponse(response: Response): never {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new PermanentAdapterError(`Invalid DataForSEO credentials (HTTP ${status})`, 'copilot');
    }

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('DataForSEO rate limit exceeded', 'copilot', retryAfterMs);
    }

    if (status === 500 || status === 502 || status === 503) {
      throw new TransientAdapterError(`DataForSEO server error (HTTP ${status})`, 'copilot');
    }

    throw new AdapterError(`DataForSEO request failed (HTTP ${status})`, 'copilot');
  }

  private handleTaskError(task: DataForSeoCopilotTask): void {
    const code = task.status_code;

    // 20000 = success
    if (code >= 20000 && code < 30000) return;

    if (code >= 40000 && code < 50000) {
      throw new PermanentAdapterError(
        `DataForSEO task error: ${task.status_message} (${code})`,
        'copilot'
      );
    }

    if (code >= 50000) {
      throw new TransientAdapterError(
        `DataForSEO task error: ${task.status_message} (${code})`,
        'copilot'
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
        throw new TransientAdapterError('DataForSEO request timed out', 'copilot');
      }
      throw new TransientAdapterError(
        `DataForSEO network error: ${error instanceof Error ? error.message : 'unknown'}`,
        'copilot',
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
