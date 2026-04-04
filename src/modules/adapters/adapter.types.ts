// ---------------------------------------------------------------------------
// Adapter types — the contract every AI platform adapter implements.
// ---------------------------------------------------------------------------

// -- Encrypted credential value stored in DB --------------------------------

export interface EncryptedValue {
  ciphertext: string; // hex-encoded
  iv: string; // hex-encoded
  tag: string; // hex-encoded
  keyVersion: number;
}

// -- Core adapter interface -------------------------------------------------

export interface QueryOptions {
  locale?: string;
  timeout?: number;
  idempotencyKey?: string;
}

export interface PlatformResponseMetadata {
  requestId: string;
  timestamp: Date;
  latencyMs: number;
  model: string;
  tokensUsed?: number;
}

export interface PlatformResponse {
  rawResponse: unknown;
  textContent: string;
  metadata: PlatformResponseMetadata;
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
  position: number;
}

export type HealthStatusValue = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthStatus {
  status: HealthStatusValue;
  latencyMs: number;
  message?: string;
  lastCheckedAt: Date;
}

export interface PlatformAdapter {
  readonly platformId: string;
  readonly platformName: string;
  query(prompt: string, options?: QueryOptions): Promise<PlatformResponse>;
  extractCitations(
    response: PlatformResponse,
    brand: { name: string; aliases: string[] }
  ): Promise<Citation[]>;
  healthCheck(): Promise<HealthStatus>;
}

// -- Adapter metadata & credential schema -----------------------------------

export type HealthCheckStrategy = 'api_ping' | 'lightweight_query' | 'auth_verify';

export interface CredentialFieldSchema {
  field: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  sensitive: boolean;
}

export type AdapterCredentialSchema = CredentialFieldSchema[];

export interface AdapterMetadata {
  platformId: string;
  displayName: string;
  version: string;
  apiVersion: string;
  capabilities: string[];
  credentialSchema: AdapterCredentialSchema;
  healthCheckStrategy: HealthCheckStrategy;
  supportedLocales?: string[];
}

// -- Adapter configuration (matches DB record shape) ------------------------

export interface AdapterConfig {
  id: string;
  workspaceId: string;
  platformId: string;
  displayName: string;
  enabled: boolean;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  rateLimitPoints: number;
  rateLimitDuration: number;
  timeoutMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

// -- Adapter factory type ---------------------------------------------------

export type AdapterFactory = (config: AdapterConfig) => PlatformAdapter;

// -- Error hierarchy --------------------------------------------------------

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly platformId: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class TransientAdapterError extends AdapterError {
  constructor(message: string, platformId: string, cause?: unknown) {
    super(message, platformId, cause);
    this.name = 'TransientAdapterError';
  }
}

export class PermanentAdapterError extends AdapterError {
  constructor(message: string, platformId: string, cause?: unknown) {
    super(message, platformId, cause);
    this.name = 'PermanentAdapterError';
  }
}

export class RateLimitAdapterError extends TransientAdapterError {
  constructor(
    message: string,
    platformId: string,
    public readonly retryAfterMs: number,
    cause?: unknown
  ) {
    super(message, platformId, cause);
    this.name = 'RateLimitAdapterError';
  }
}
