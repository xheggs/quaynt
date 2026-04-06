import type { Logger } from 'pino';
import {
  AdapterError,
  PermanentAdapterError,
  RateLimitAdapterError,
  TransientAdapterError,
} from '../adapter.types';
import type {
  DeepSeekChatRequest,
  DeepSeekChatResponse,
  DeepSeekErrorResponse,
} from './deepseek.types';

export const DEEPSEEK_API_BASE = 'https://api.deepseek.com';
const PLATFORM_ID = 'deepseek';
const DEFAULT_RETRY_AFTER_MS = 60_000;

export class DeepSeekClient {
  constructor(
    private readonly apiKey: string,
    private readonly log: Logger
  ) {}

  async createChatCompletion(
    request: DeepSeekChatRequest,
    options?: { timeoutMs?: number }
  ): Promise<{ body: DeepSeekChatResponse }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
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
      await this.handleErrorResponse(response);
    }

    const body = (await response.json()) as DeepSeekChatResponse;

    this.log.debug({ model: request.model, responseId: body.id }, 'DeepSeek response received');

    return { body };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const errorMessage = await this.parseErrorMessage(response);

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfterMs(response.headers);
      throw new RateLimitAdapterError(
        errorMessage || 'DeepSeek rate limit exceeded',
        PLATFORM_ID,
        retryAfterMs
      );
    }

    if (status === 402) {
      throw new PermanentAdapterError(
        errorMessage || 'DeepSeek API insufficient balance',
        PLATFORM_ID
      );
    }

    if ([400, 401, 422].includes(status)) {
      throw new PermanentAdapterError(
        errorMessage || `DeepSeek API error (${status})`,
        PLATFORM_ID
      );
    }

    if ([500, 503].includes(status)) {
      throw new TransientAdapterError(
        errorMessage || `DeepSeek server error (${status})`,
        PLATFORM_ID
      );
    }

    throw new AdapterError(
      errorMessage || `Unexpected DeepSeek API status: ${status}`,
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
      const body = (await response.json()) as DeepSeekErrorResponse;
      return body.error?.message ?? '';
    } catch {
      return '';
    }
  }
}
