import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  OpenAIResponsesRequest,
  OpenAIResponsesResponse,
  RateLimitInfo,
} from './chatgpt.types';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const PLATFORM_ID = 'chatgpt';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class ChatGPTClient {
  constructor(
    private readonly apiKey: string,
    private readonly organizationId: string | undefined,
    private readonly log: Logger
  ) {}

  async createResponse(
    request: OpenAIResponsesRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<{ body: OpenAIResponsesResponse; rateLimits: RateLimitInfo }> {
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
      response = await fetch(`${OPENAI_API_BASE}/responses`, {
        method: 'POST',
        headers: this.buildHeaders(),
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

    const body = (await response.json()) as OpenAIResponsesResponse;
    const rateLimits = this.parseRateLimitHeaders(response.headers);

    this.log.debug(
      { model: request.model, responseId: body.id, rateLimits },
      'OpenAI response received'
    );

    return { body, rateLimits };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }
    return headers;
  }

  private handleErrorResponse(response: Response): never {
    const status = response.status;

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError('OpenAI rate limit exceeded', PLATFORM_ID, retryAfterMs);
    }

    if ([400, 401, 403, 404, 422].includes(status)) {
      throw new PermanentAdapterError(`OpenAI API error (${status})`, PLATFORM_ID);
    }

    if ([500, 502, 503, 504].includes(status)) {
      throw new TransientAdapterError(`OpenAI server error (${status})`, PLATFORM_ID);
    }

    throw new AdapterError(`Unexpected OpenAI API status: ${status}`, PLATFORM_ID);
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

    const remainingTok = headers.get('x-ratelimit-remaining-tokens');
    if (remainingTok) info.remainingTokens = parseInt(remainingTok, 10);

    const resetTok = headers.get('x-ratelimit-reset-tokens');
    if (resetTok) info.resetTokens = resetTok;

    return info;
  }
}
