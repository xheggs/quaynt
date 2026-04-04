import { RateLimiterPostgres, RateLimiterRes } from 'rate-limiter-flexible';
import { pool } from '@/lib/db/pool';
import { env } from '@/lib/config/env';
import { getAuthContext } from './middleware';
import { getRequestLogger } from '@/lib/logger';
import { tooManyRequests } from './response';
import type { AuthenticatedHandler } from './types';

type RateLimitOptions = {
  points?: number;
  duration?: number;
};

const limiters = new Map<string, RateLimiterPostgres>();

function getLimiter(points: number, duration: number): RateLimiterPostgres {
  const key = `${points}:${duration}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new RateLimiterPostgres({
      storeClient: pool,
      points,
      duration,
      keyPrefix: `rl_api_${key}`,
      tableCreated: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

function getRateLimitKey(req: Request): string {
  const auth = getAuthContext(req);
  return auth.method === 'api-key' ? auth.apiKeyId : auth.userId;
}

export function withRateLimit<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T>,
  opts?: RateLimitOptions
): AuthenticatedHandler<T> {
  return async (req, ctx) => {
    const points = opts?.points ?? env.RATE_LIMIT_POINTS;
    const duration = opts?.duration ?? env.RATE_LIMIT_DURATION;
    const limiter = getLimiter(points, duration);
    const key = getRateLimitKey(req);

    try {
      const res = await limiter.consume(key, 1);
      const response = await handler(req, ctx);
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

      // Fail open — DB error should not block requests
      getRequestLogger(req).warn({ err: error }, 'Rate limiter unavailable, allowing request');
      return handler(req, ctx);
    }
  };
}
