import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  OpenRouterChatRequest,
  OpenRouterChatResponse,
  OpenRouterErrorResponse,
} from './openrouter.types';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_RETRY_AFTER_MS = 60_000;

/**
 * Thin wrapper around OpenRouter's Chat Completions endpoint. OpenRouter is
 * OpenAI-compatible on the wire; this client mirrors the project's other
 * adapter clients (DeepSeek, Perplexity) for consistency rather than pulling
 * in the openai SDK — keeps the dependency surface flat.
 */
export class OpenRouterClient {
  constructor(
    private readonly apiKey: string,
    private readonly platformId: string,
    private readonly log: Logger
  ) {}

  async createChatCompletion(
    request: OpenRouterChatRequest,
    options?: { timeoutMs?: number }
  ): Promise<{ body: OpenRouterChatResponse }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          // OpenRouter requires a referer/title for routing analytics; harmless
          // when running headless. See https://openrouter.ai/docs/api-reference/overview
          'HTTP-Referer': 'https://github.com/xheggs/quaynt',
          'X-Title': 'Quaynt',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TransientAdapterError(
          `Request timed out after ${timeoutMs}ms`,
          this.platformId,
          error
        );
      }
      throw new TransientAdapterError(
        `Network error: ${error instanceof Error ? error.message : 'unknown'}`,
        this.platformId,
        error
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const body = (await response.json()) as OpenRouterChatResponse;

    this.log.debug({ model: request.model, responseId: body.id }, 'OpenRouter response received');

    return { body };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const errorMessage = await this.parseErrorMessage(response);

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError(
        errorMessage || 'OpenRouter rate limit exceeded',
        this.platformId,
        retryAfterMs
      );
    }

    if (status === 402) {
      throw new PermanentAdapterError(
        errorMessage || 'OpenRouter account credit exhausted',
        this.platformId
      );
    }

    if ([400, 401, 403, 422].includes(status)) {
      throw new PermanentAdapterError(
        errorMessage || `OpenRouter API error (${status})`,
        this.platformId
      );
    }

    if ([500, 502, 503, 504].includes(status)) {
      throw new TransientAdapterError(
        errorMessage || `OpenRouter server error (${status})`,
        this.platformId
      );
    }

    throw new AdapterError(
      errorMessage || `Unexpected OpenRouter API status: ${status}`,
      this.platformId
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

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as OpenRouterErrorResponse;
      return body.error?.message ?? '';
    } catch {
      return '';
    }
  }
}
