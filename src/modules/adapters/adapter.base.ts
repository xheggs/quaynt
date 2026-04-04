import { logger } from '@/lib/logger';
import type {
  AdapterConfig,
  Citation,
  HealthStatus,
  PlatformAdapter,
  PlatformResponse,
  QueryOptions,
} from './adapter.types';
import { RateLimitAdapterError } from './adapter.types';
import { CircuitBreaker } from './adapter.resilience';
import { retryWithBackoff } from './adapter.resilience';

// -- In-memory token bucket rate limiter ------------------------------------

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillDurationMs: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillDurationMs) * this.maxTokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// -- Base platform adapter --------------------------------------------------

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platformId: string;
  abstract readonly platformName: string;

  protected readonly log;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: TokenBucket;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(protected readonly adapterConfig: AdapterConfig) {
    this.log = logger.child({
      adapterId: adapterConfig.id,
      platformId: adapterConfig.platformId,
    });

    this.circuitBreaker = new CircuitBreaker({
      errorThresholdPercent: adapterConfig.circuitBreakerThreshold,
      resetTimeoutMs: adapterConfig.circuitBreakerResetMs,
    });

    this.rateLimiter = new TokenBucket(
      adapterConfig.rateLimitPoints,
      adapterConfig.rateLimitDuration * 1000
    );

    this.maxRetries = adapterConfig.maxRetries;
    this.timeoutMs = adapterConfig.timeoutMs;
  }

  async query(prompt: string, options?: QueryOptions): Promise<PlatformResponse> {
    if (!this.rateLimiter.consume()) {
      throw new RateLimitAdapterError(
        'Client-side rate limit exceeded',
        this.platformId,
        this.adapterConfig.rateLimitDuration * 1000
      );
    }

    return this.circuitBreaker.execute(() =>
      retryWithBackoff(
        () =>
          this.doQuery(prompt, {
            ...options,
            timeout: options?.timeout ?? this.timeoutMs,
          }),
        { maxAttempts: this.maxRetries }
      )
    );
  }

  async extractCitations(
    response: PlatformResponse,
    brand: { name: string; aliases: string[] }
  ): Promise<Citation[]> {
    return this.doExtractCitations(response, brand);
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.doHealthCheck();
  }

  // -- Abstract methods for concrete adapters to implement ------------------

  protected abstract doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse>;

  protected abstract doExtractCitations(
    response: PlatformResponse,
    brand: { name: string; aliases: string[] }
  ): Promise<Citation[]>;

  protected abstract doHealthCheck(): Promise<HealthStatus>;
}
