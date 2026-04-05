import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  ClaudeMessagesRequest,
  ClaudeMessagesResponse,
  ClaudeErrorResponse,
  ClaudeRateLimitInfo,
} from './claude.types';

export const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
export const ANTHROPIC_API_VERSION = '2023-06-01';
const PLATFORM_ID = 'claude';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class ClaudeClient {
  constructor(
    private readonly apiKey: string,
    private readonly log: Logger
  ) {}

  async sendMessage(
    request: ClaudeMessagesRequest,
    options?: { timeoutMs?: number }
  ): Promise<{ body: ClaudeMessagesResponse; rateLimits: ClaudeRateLimitInfo }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
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
      await this.handleErrorResponse(response);
    }

    const body = (await response.json()) as ClaudeMessagesResponse;
    const rateLimits = this.parseRateLimits(response.headers);

    this.log.debug(
      { model: request.model, messageId: body.id, rateLimits },
      'Anthropic response received'
    );

    return { body, rateLimits };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const errorMessage = await this.parseErrorMessage(response);

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError(
        `Anthropic rate limit exceeded: ${errorMessage}`,
        PLATFORM_ID,
        retryAfterMs
      );
    }

    // HTTP 529 is Anthropic-specific — server overload.
    // Must be classified as transient, NOT rate limit (per D6).
    if (status === 529) {
      throw new TransientAdapterError(`Anthropic API overloaded: ${errorMessage}`, PLATFORM_ID);
    }

    if ([400, 401, 402, 403, 404, 413].includes(status)) {
      throw new PermanentAdapterError(
        `Anthropic API error (${status}): ${errorMessage}`,
        PLATFORM_ID
      );
    }

    if (status === 500) {
      throw new TransientAdapterError(
        `Anthropic server error (${status}): ${errorMessage}`,
        PLATFORM_ID
      );
    }

    throw new AdapterError(
      `Unexpected Anthropic API status (${status}): ${errorMessage}`,
      PLATFORM_ID
    );
  }

  private parseRetryAfterMs(headers: Headers): number {
    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseFloat(retryAfter);
      if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
    }
    return DEFAULT_RETRY_AFTER_MS;
  }

  private parseRateLimits(headers: Headers): ClaudeRateLimitInfo {
    const info: ClaudeRateLimitInfo = {};

    const requestsLimit = headers.get('anthropic-ratelimit-requests-limit');
    if (requestsLimit) info.requestsLimit = parseInt(requestsLimit, 10);

    const requestsRemaining = headers.get('anthropic-ratelimit-requests-remaining');
    if (requestsRemaining) info.requestsRemaining = parseInt(requestsRemaining, 10);

    const requestsReset = headers.get('anthropic-ratelimit-requests-reset');
    if (requestsReset) info.requestsReset = requestsReset;

    const tokensLimit = headers.get('anthropic-ratelimit-tokens-limit');
    if (tokensLimit) info.tokensLimit = parseInt(tokensLimit, 10);

    const tokensRemaining = headers.get('anthropic-ratelimit-tokens-remaining');
    if (tokensRemaining) info.tokensRemaining = parseInt(tokensRemaining, 10);

    const tokensReset = headers.get('anthropic-ratelimit-tokens-reset');
    if (tokensReset) info.tokensReset = tokensReset;

    const inputTokensLimit = headers.get('anthropic-ratelimit-input-tokens-limit');
    if (inputTokensLimit) info.inputTokensLimit = parseInt(inputTokensLimit, 10);

    const inputTokensRemaining = headers.get('anthropic-ratelimit-input-tokens-remaining');
    if (inputTokensRemaining) info.inputTokensRemaining = parseInt(inputTokensRemaining, 10);

    const inputTokensReset = headers.get('anthropic-ratelimit-input-tokens-reset');
    if (inputTokensReset) info.inputTokensReset = inputTokensReset;

    const outputTokensLimit = headers.get('anthropic-ratelimit-output-tokens-limit');
    if (outputTokensLimit) info.outputTokensLimit = parseInt(outputTokensLimit, 10);

    const outputTokensRemaining = headers.get('anthropic-ratelimit-output-tokens-remaining');
    if (outputTokensRemaining) info.outputTokensRemaining = parseInt(outputTokensRemaining, 10);

    const outputTokensReset = headers.get('anthropic-ratelimit-output-tokens-reset');
    if (outputTokensReset) info.outputTokensReset = outputTokensReset;

    return info;
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as ClaudeErrorResponse;
      const message = body.error?.message ?? `HTTP ${response.status}`;
      return body.request_id ? `${message} (request_id: ${body.request_id})` : message;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}
