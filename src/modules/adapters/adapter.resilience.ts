import { TransientAdapterError } from './adapter.types';

// -- Retry with exponential backoff -----------------------------------------

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isTransientError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      // ±10% jitter
      const jitter = delay * 0.1 * (2 * Math.random() - 1);
      await sleep(Math.round(delay + jitter));
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Circuit breaker --------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  errorThresholdPercent?: number;
  resetTimeoutMs?: number;
  rollingWindowMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  private readonly errorThresholdPercent: number;
  private readonly resetTimeoutMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.errorThresholdPercent = options?.errorThresholdPercent ?? 50;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 60_000;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new TransientAdapterError('Circuit breaker is open', 'unknown');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    this.successes++;
    if (this.state === 'HALF_OPEN') {
      this.reset();
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      return;
    }

    const total = this.failures + this.successes;
    if (total > 0 && (this.failures / total) * 100 >= this.errorThresholdPercent) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
  }
}

// -- Error classification ---------------------------------------------------

export function isTransientError(error: unknown): boolean {
  if (error instanceof TransientAdapterError) return true;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound') ||
      msg.includes('fetch failed')
    ) {
      return true;
    }
  }

  // HTTP status-like errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status;
    return status === 429 || (status >= 500 && status < 600);
  }

  return false;
}
