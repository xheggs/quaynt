/**
 * Client-side integration types for adapters, API keys, and webhooks.
 *
 * These mirror server-side types but are duplicated here to avoid importing
 * from server modules, which can break client component bundling.
 */

// ─── Adapters ────────────────────────────────────────────────────────────────

// Source: @/modules/adapters/adapter.schema (platform registry)
export interface CredentialField {
  key: string;
  type: 'text' | 'password' | 'number';
  required: boolean;
  description: string;
  default?: string | number;
}

// Source: @/modules/adapters/adapter.schema (platform registry)
export interface ConfigField {
  key: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  description: string;
  default?: string | number;
  min?: number;
  max?: number;
  options?: string[];
}

// Source: GET /api/v1/adapters/platforms
export interface PlatformInfo {
  platformId: string;
  platformName: string;
  credentialSchema: CredentialField[];
  configSchema: ConfigField[];
}

// Source: @/modules/adapters/adapter.schema
export interface AdapterConfig {
  id: string;
  workspaceId: string;
  platformId: string;
  displayName: string;
  enabled: boolean;
  credentialsSet: boolean;
  config: Record<string, unknown>;
  rateLimitPoints: number;
  rateLimitDuration: number;
  timeoutMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  lastHealthStatus: string | null;
  lastHealthCheckedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Source: POST /api/v1/adapters
export interface AdapterCreate {
  platformId: string;
  displayName: string;
  credentials: Record<string, string | number>;
  config?: Record<string, unknown>;
}

// Source: PATCH /api/v1/adapters/:id
export interface AdapterUpdate {
  displayName?: string;
  credentials?: Record<string, string | number>;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

// Source: GET /api/v1/adapters/:id/health
export interface AdapterHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  checkedAt: string;
  latencyMs?: number;
}

// ─── API Keys ────────────────────────────────────────────────────────────────

// Source: @/modules/workspace/api-key.schema
export type ApiKeyScope = 'read' | 'read-write' | 'admin';

// Source: @/modules/workspace/api-key.service (listApiKeys)
export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Source: POST /api/v1/api-keys
export interface ApiKeyCreate {
  name: string;
  scope: ApiKeyScope;
  expiresAt?: string;
}

// Source: POST /api/v1/api-keys (response — plaintext returned once)
export interface ApiKeyGenerated extends ApiKeyInfo {
  key: string;
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

// Source: @/modules/webhooks/webhook-endpoint.schema
export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  enabled: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Source: POST /api/v1/webhooks
export interface WebhookCreate {
  url: string;
  events: string[];
  description?: string;
}

// Source: PATCH /api/v1/webhooks/:id
export interface WebhookUpdate {
  url?: string;
  events?: string[];
  description?: string | null;
  enabled?: boolean;
}

// Source: @/modules/webhooks/webhook-delivery.schema
export interface WebhookDelivery {
  id: string;
  eventType: string;
  attemptNumber: number;
  status: 'pending' | 'success' | 'failed';
  httpStatus: number | null;
  responseLatencyMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Source: POST /api/v1/webhooks/:id/secret/rotate
export interface WebhookSecretRotation {
  secret: string;
}

// ─── Helper Constants ────────────────────────────────────────────────────────

export const API_KEY_SCOPES: ApiKeyScope[] = ['read', 'read-write', 'admin'];

export const SERP_ADAPTER_PLATFORMS = ['ai-overviews', 'copilot'] as const;

export const WEBHOOK_EVENT_CATEGORIES = [
  'citation',
  'alert',
  'report',
  'model_run',
  'brand',
  'prompt_set',
  'adapter',
  'visibility',
  'report_schedule',
  'webhook',
] as const;
