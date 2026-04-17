import { withRequestId } from './request-id';
import { withRequestLog } from './request-log';
import { withRateLimit } from './rate-limit';
import { withCors, type CorsOptions } from './cors';
import type { ApiHandler, RouteContext } from './types';

/**
 * Per-IP + per-keyExtractor rate limits for public endpoints. Both axes are enforced
 * independently; a request must pass both to proceed.
 */
export interface PublicCollectorOptions<T = Record<string, string>> {
  /** Total requests per window, per IP. Default 60/min. */
  perIpPoints?: number;
  perIpDurationSec?: number;
  /** Total requests per window, per custom key (e.g. site key). Default 10000/min. */
  perKeyPoints?: number;
  perKeyDurationSec?: number;
  /** Extracts a stable key from the request — typically the site key from the URL. */
  keyExtractor: (req: Request, ctx: RouteContext<T>) => string | Promise<string>;
  /** CORS options for the endpoint. Defaults to fully open (allowOrigins: '*'). */
  cors?: CorsOptions;
}

function getClientIp(req: Request): string {
  // Prefer the left-most entry of X-Forwarded-For (the original client). Falls back to
  // the socket remote address exposed by Next.js as `x-real-ip` in some deployments.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

/**
 * Wraps a public (unauthenticated) route handler with the standard observability +
 * safety middleware chain: request ID, structured logging, per-IP rate limit,
 * per-key rate limit, and CORS response headers.
 *
 * The chain composes from innermost to outermost:
 *   withRequestId(withRequestLog(perIpLimit(perKeyLimit(withCors(handler)))))
 *
 * Rate limits fail open on DB errors (see withRateLimit) — that trade-off is documented
 * in the PRP: rate limiting is hardening, not authentication.
 */
export function withPublicCollector<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>,
  opts: PublicCollectorOptions<T>
): ApiHandler<T> {
  const corsOpts: CorsOptions = opts.cors ?? {
    allowOrigins: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  };

  // CORS innermost → it tags response headers on everything the handler returns.
  const withCorsHandler = withCors<T>(handler, corsOpts);

  // Per-site-key rate limit — guards against one misbehaving key saturating the system.
  const perKey = withRateLimit<T>(withCorsHandler, {
    points: opts.perKeyPoints ?? 10_000,
    duration: opts.perKeyDurationSec ?? 60,
    keyExtractor: opts.keyExtractor,
    keyPrefix: 'rl_public_key',
    unauthenticated: true,
  });

  // Per-IP rate limit — guards against abusive clients spamming a single site key.
  const perIp = withRateLimit<T>(perKey, {
    points: opts.perIpPoints ?? 60,
    duration: opts.perIpDurationSec ?? 60,
    keyExtractor: (req) => getClientIp(req),
    keyPrefix: 'rl_public_ip',
    unauthenticated: true,
  });

  return withRequestId<T>(withRequestLog<T>(perIp));
}
