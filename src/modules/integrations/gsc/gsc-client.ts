// ---------------------------------------------------------------------------
// Google Search Console API client.
//
// Thin wrapper around the `searchanalytics/query` and `sites` endpoints.
// Implements:
//   - On-demand access-token refresh (triggered by expiry or a 401 response)
//   - Per-connection client-side rate limiting (25 QPM — Google's cap is 30)
//   - Circuit breaker around the transport
//   - Exponential backoff with jitter for 5xx; honors `Retry-After` on 429
//   - Clear typed errors so callers can react appropriately
//
// The client never logs tokens or Authorization headers.
// ---------------------------------------------------------------------------

import type pino from 'pino';
import { logger } from '@/lib/logger';
import { CircuitBreaker } from '@/modules/adapters/adapter.resilience';
import { refreshAccessToken, OAuthTokenError, type GoogleSite } from './gsc-oauth.service';
import {
  getConnectionWithTokens,
  updateAccessToken,
  updateConnectionStatus,
  type ConnectionWithTokens,
} from './gsc-connection.service';

// -- Errors -----------------------------------------------------------------

export class GscClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GscClientError';
  }
}

export class GscReauthRequiredError extends GscClientError {
  constructor() {
    super('GSC connection requires re-authorization');
    this.name = 'GscReauthRequiredError';
  }
}

export class GscForbiddenError extends GscClientError {
  constructor() {
    super('Google reports no access for this property');
    this.name = 'GscForbiddenError';
  }
}

export class GscRateLimitedError extends GscClientError {
  constructor(public readonly retryAfterSeconds: number | null) {
    super('GSC API rate limited');
    this.name = 'GscRateLimitedError';
  }
}

export class GscTransientError extends GscClientError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GscTransientError';
  }
}

// -- Types ------------------------------------------------------------------

export interface GscSearchAnalyticsRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions?: ('date' | 'query' | 'page' | 'country' | 'device' | 'searchAppearance')[];
  rowLimit?: number;
  startRow?: number;
  aggregationType?: 'auto' | 'byPage' | 'byProperty';
}

export interface GscSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
}

// -- Per-connection resilience primitives -----------------------------------

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

interface ConnectionResilience {
  bucket: TokenBucket;
  breaker: CircuitBreaker;
}

const resilienceByConnection = new Map<string, ConnectionResilience>();

// Google's published limit is 30 QPM per user. We stay at 25 to leave headroom.
const BUCKET_MAX_TOKENS = 25;
const BUCKET_REFILL_MS = 60_000;

function getResilience(connectionId: string): ConnectionResilience {
  let entry = resilienceByConnection.get(connectionId);
  if (!entry) {
    entry = {
      bucket: new TokenBucket(BUCKET_MAX_TOKENS, BUCKET_REFILL_MS),
      breaker: new CircuitBreaker({ errorThresholdPercent: 50, resetTimeoutMs: 60_000 }),
    };
    resilienceByConnection.set(connectionId, entry);
  }
  return entry;
}

/**
 * Test helper — resets the in-memory rate limiter / circuit breaker cache.
 */
export function __resetClientCaches(): void {
  resilienceByConnection.clear();
}

// -- Token refresh helper ---------------------------------------------------

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

async function ensureFreshAccessToken(connection: ConnectionWithTokens): Promise<string> {
  const expiresIn = connection.tokenExpiresAt.getTime() - Date.now();
  if (expiresIn > ACCESS_TOKEN_REFRESH_SKEW_MS) {
    return connection.accessToken;
  }
  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    await updateAccessToken(connection.id, refreshed.accessToken, refreshed.expiresAt);
    return refreshed.accessToken;
  } catch (err) {
    if (err instanceof OAuthTokenError) {
      await updateConnectionStatus(connection.id, 'reauth_required', err.message);
      throw new GscReauthRequiredError();
    }
    throw err;
  }
}

// -- Low-level HTTP with retries --------------------------------------------

const MAX_TRANSIENT_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, log: pino.Logger): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_TRANSIENT_RETRIES) {
        throw new GscTransientError(err instanceof Error ? err.message : 'Network error');
      }
      const jitter = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.9 + Math.random() * 0.2);
      await sleep(Math.round(jitter));
      continue;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '0');
      if (attempt < MAX_TRANSIENT_RETRIES) {
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt);
        log.warn({ attempt, waitMs }, '[gsc] 429 received, backing off');
        await sleep(waitMs);
        continue;
      }
      throw new GscRateLimitedError(retryAfter > 0 ? retryAfter : null);
    }

    if (res.status >= 500 && res.status < 600) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        const jitter = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.9 + Math.random() * 0.2);
        log.warn(
          { attempt, status: res.status, waitMs: Math.round(jitter) },
          '[gsc] 5xx, retrying'
        );
        await sleep(Math.round(jitter));
        continue;
      }
      throw new GscTransientError(`GSC API ${res.status}`, res.status);
    }

    return res;
  }

  throw lastErr instanceof Error ? lastErr : new GscTransientError('Exhausted retries');
}

// -- Public client API ------------------------------------------------------

/**
 * Execute a Search Analytics query against the connection's property.
 *
 * Token refresh, retries, rate limiting, and circuit breaker are handled
 * internally. Callers should catch the exported typed errors to react.
 */
export async function searchAnalyticsQuery(
  connectionId: string,
  body: GscSearchAnalyticsRequest
): Promise<GscSearchAnalyticsResponse> {
  const connection = await getConnectionWithTokens(connectionId);
  if (!connection) throw new GscClientError(`GSC connection not found: ${connectionId}`);

  const resilience = getResilience(connectionId);
  if (!resilience.bucket.consume()) {
    throw new GscRateLimitedError(null);
  }

  const log = logger.child({ gscConnectionId: connectionId, propertyUrl: connection.propertyUrl });

  return resilience.breaker.execute(async () => {
    let accessToken = await ensureFreshAccessToken(connection);

    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      connection.propertyUrl
    )}/searchAnalytics/query`;

    const makeRequest = (token: string) =>
      fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        log
      );

    let res = await makeRequest(accessToken);

    if (res.status === 401) {
      // Force-refresh and retry once.
      const refreshed = await refreshAccessToken(connection.refreshToken).catch((err) => {
        if (err instanceof OAuthTokenError) {
          void updateConnectionStatus(connectionId, 'reauth_required', err.message);
          throw new GscReauthRequiredError();
        }
        throw err;
      });
      await updateAccessToken(connectionId, refreshed.accessToken, refreshed.expiresAt);
      accessToken = refreshed.accessToken;
      res = await makeRequest(accessToken);

      if (res.status === 401) {
        await updateConnectionStatus(connectionId, 'reauth_required', 'Repeated 401 after refresh');
        throw new GscReauthRequiredError();
      }
    }

    if (res.status === 403) {
      await updateConnectionStatus(connectionId, 'forbidden', 'Google returned 403');
      throw new GscForbiddenError();
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GscClientError(`GSC API ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as GscSearchAnalyticsResponse;
    log.debug({ rowCount: payload.rows?.length ?? 0 }, '[gsc] searchAnalyticsQuery ok');
    return { rows: payload.rows ?? [], responseAggregationType: payload.responseAggregationType };
  });
}

/**
 * List the Search Console sites accessible to this connection.
 *
 * Distinct from `listSitesForToken()` in the OAuth module — this variant
 * uses a stored connection (with token refresh + resilience), not a raw
 * short-lived access token.
 */
export async function listSites(connectionId: string): Promise<GoogleSite[]> {
  const connection = await getConnectionWithTokens(connectionId);
  if (!connection) throw new GscClientError(`GSC connection not found: ${connectionId}`);

  const resilience = getResilience(connectionId);
  if (!resilience.bucket.consume()) {
    throw new GscRateLimitedError(null);
  }

  const log = logger.child({ gscConnectionId: connectionId });

  return resilience.breaker.execute(async () => {
    const accessToken = await ensureFreshAccessToken(connection);

    const res = await fetchWithRetry(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      log
    );

    if (!res.ok) {
      throw new GscClientError(`GSC sites list failed: ${res.status}`);
    }

    const data = (await res.json()) as { siteEntry?: GoogleSite[] };
    return data.siteEntry ?? [];
  });
}
