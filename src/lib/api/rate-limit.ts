import { RateLimiterPostgres, RateLimiterRes } from 'rate-limiter-flexible';
import { pool } from '@/lib/db/pool';
import { env } from '@/lib/config/env';
import { getAuthContext } from './middleware';
import { getRequestLogger } from '@/lib/logger';
import { tooManyRequests } from './response';
import type { ApiHandler, AuthenticatedHandler, RouteContext } from './types';

type RateLimitOptions<T = Record<string, string>> = {
  points?: number;
  duration?: number;
  /**
   * Override the key used for rate limiting. When supplied, replaces the default
   * authenticated-principal key. Useful for public endpoints that key on IP, site key,
   * or other request-derived attributes. May be async to perform a DB lookup.
   */
  keyExtractor?: (req: Request, ctx: RouteContext<T>) => string | Promise<string>;
  /**
   * Prefix for the rate-limit table key. Different prefixes create independent rate-limit
   * buckets — useful when running multiple withRateLimit wrappers on the same endpoint
   * (e.g. per-IP AND per-siteKey). Defaults to `rl_api`.
   */
  keyPrefix?: string;
  /** If true, swallow auth lookups — use when wrapping a public/unauthenticated handler. */
  unauthenticated?: boolean;
};

const limiters = new Map<string, RateLimiterPostgres>();

function getLimiter(points: number, duration: number, keyPrefix: string): RateLimiterPostgres {
  const key = `${keyPrefix}:${points}:${duration}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new RateLimiterPostgres({
      storeClient: pool,
      points,
      duration,
      keyPrefix: key,
      tableCreated: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export type ConsumeResult =
  | { ok: true; remainingPoints: number }
  | { ok: false; retryAfter: number };

/**
 * Ad-hoc rate-limit consume for handlers that need to apply an additional
 * limit conditionally (e.g. only when a specific request flag is set). Fails
 * open on DB errors, like `withRateLimit`.
 */
export async function consumeRateLimit(opts: {
  key: string;
  points: number;
  duration: number;
  keyPrefix: string;
}): Promise<ConsumeResult> {
  const limiter = getLimiter(opts.points, opts.duration, opts.keyPrefix);
  try {
    const res = await limiter.consume(opts.key, 1);
    return { ok: true, remainingPoints: res.remainingPoints };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return { ok: false, retryAfter: Math.ceil(error.msBeforeNext / 1000) };
    }
    return { ok: true, remainingPoints: -1 };
  }
}

function defaultAuthenticatedKey(req: Request): string {
  const auth = getAuthContext(req);
  return auth.method === 'api-key' ? auth.apiKeyId : auth.userId;
}

export function withRateLimit<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T>,
  opts?: RateLimitOptions<T>
): AuthenticatedHandler<T>;
export function withRateLimit<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>,
  opts: RateLimitOptions<T> & { unauthenticated: true }
): ApiHandler<T>;
export function withRateLimit<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T> | AuthenticatedHandler<T>,
  opts?: RateLimitOptions<T>
): ApiHandler<T> {
  const points = opts?.points ?? env.RATE_LIMIT_POINTS;
  const duration = opts?.duration ?? env.RATE_LIMIT_DURATION;
  const keyPrefix = opts?.keyPrefix ?? 'rl_api';

  return async (req, ctx) => {
    const limiter = getLimiter(points, duration, keyPrefix);
    const key = opts?.keyExtractor
      ? await opts.keyExtractor(req, ctx)
      : defaultAuthenticatedKey(req);

    try {
      const res = await limiter.consume(key, 1);
      const response = await (handler as ApiHandler<T>)(req, ctx);
      response.headers.set('X-RateLimit-Limit', String(points));
      response.headers.set('X-RateLimit-Remaining', String(res.remainingPoints));
      response.headers.set(
        'X-RateLimit-Reset',
        String(Math.ceil(Date.now() / 1000 + res.msBeforeNext / 1000))
      );
      return response;
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(error.msBeforeNext / 1000);
        return tooManyRequests(retryAfter);
      }

      // Fail open — DB error should not block requests.
      getRequestLogger(req).warn({ err: error }, 'Rate limiter unavailable, allowing request');
      return (handler as ApiHandler<T>)(req, ctx);
    }
  };
}
