import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  PerplexityChatRequest,
  PerplexityChatResponse,
  RateLimitInfo,
} from './perplexity.types';

const PERPLEXITY_API_BASE = 'https://api.perplexity.ai/v1';
const PLATFORM_ID = 'perplexity';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class PerplexityClient {
  constructor(
    private readonly apiKey: string,
    private readonly log: Logger
  ) {}

  async createCompletion(
    request: PerplexityChatRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<{ body: PerplexityChatResponse; rateLimits: RateLimitInfo }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Combine external signal with timeout signal
    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TransientAdapterError(
          `Request timed out after ${timeoutMs}ms`,
          PLATFORM_ID,
          error
        );
      }
      throw new TransientAdapterError(
        `Network error: ${error instanceof Error ? error.message : 'unknown'}`,
        PLATFORM_ID,
        error
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      this.handleErrorResponse(response);
    }

    const body = (await response.json()) as PerplexityChatResponse;
    const rateLimits = this.parseRateLimitHeaders(response.headers);

    this.log.debug(
      { model: request.model, responseId: body.id, rateLimits },
      'Perplexity response received'
    );

    return { body, rateLimits };
  }

  private handleErrorResponse(response: Response): never {
    const status = response.status;

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('Perplexity rate limit exceeded', PLATFORM_ID, retryAfterMs);
    }

    if ([400, 401, 403, 422].includes(status)) {
      throw new PermanentAdapterError(`Perplexity API error (${status})`, PLATFORM_ID);
    }

    if ([500, 502, 503, 504].includes(status)) {
      throw new TransientAdapterError(`Perplexity server error (${status})`, PLATFORM_ID);
    }

    throw new AdapterError(`Unexpected Perplexity API status: ${status}`, PLATFORM_ID);
  }

  private parseRetryAfterMs(headers: Headers): number {
    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseFloat(retryAfter);
      if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
    }

    const resetRequests = headers.get('x-ratelimit-reset-requests');
    if (resetRequests) {
      const seconds = parseFloat(resetRequests);
      if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
    }

    return DEFAULT_RETRY_AFTER_MS;
  }

  private parseRateLimitHeaders(headers: Headers): RateLimitInfo {
    const info: RateLimitInfo = {};

    const remainingReq = headers.get('x-ratelimit-remaining-requests');
    if (remainingReq) info.remainingRequests = parseInt(remainingReq, 10);

    const resetReq = headers.get('x-ratelimit-reset-requests');
    if (resetReq) info.resetRequests = resetReq;

    return info;
  }
}
