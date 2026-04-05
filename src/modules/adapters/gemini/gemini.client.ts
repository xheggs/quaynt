import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiErrorResponse,
} from './gemini.types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const PLATFORM_ID = 'gemini';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiVersion: string,
    private readonly log: Logger
  ) {}

  async generateContent(
    model: string,
    request: GeminiGenerateContentRequest,
    options?: { timeoutMs?: number }
  ): Promise<{ body: GeminiGenerateContentResponse }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = `${GEMINI_API_BASE}/${this.apiVersion}/models/${model}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
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

    const body = (await response.json()) as GeminiGenerateContentResponse;

    this.log.debug({ model, url }, 'Gemini response received');

    return { body };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const errorMessage = await this.parseErrorMessage(response);

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError(
        `Gemini rate limit exceeded: ${errorMessage}`,
        PLATFORM_ID,
        retryAfterMs
      );
    }

    if ([400, 403, 404].includes(status)) {
      throw new PermanentAdapterError(`Gemini API error (${status}): ${errorMessage}`, PLATFORM_ID);
    }

    if ([500, 503, 504].includes(status)) {
      throw new TransientAdapterError(
        `Gemini server error (${status}): ${errorMessage}`,
        PLATFORM_ID
      );
    }

    throw new AdapterError(
      `Unexpected Gemini API status (${status}): ${errorMessage}`,
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

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as GeminiErrorResponse;
      return body.error?.message ?? `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}
