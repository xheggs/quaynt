import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/config/env';
import type { ApiHandler } from './types';

export type CorsOptions = {
  /**
   * Origins allowed to call this route. Pass `'*'` for a fully open endpoint, an array
   * for an allowlist, or omit to fall back to the env-configured `CORS_ALLOWED_ORIGINS`.
   */
  allowOrigins?: '*' | string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  maxAge?: number;
};

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Request-Id'];
const DEFAULT_MAX_AGE = 86400;

function getEnvAllowedOrigins(): string[] {
  return env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
}

function setCorsHeaders(response: NextResponse, origin: string | null, opts: CorsOptions): void {
  const origins = opts.allowOrigins ?? getEnvAllowedOrigins();
  const isWildcard =
    origins === '*' || (Array.isArray(origins) && origins.length === 1 && origins[0] === '*');

  if (isWildcard) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (Array.isArray(origins) && origin && origins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  } else {
    return;
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    (opts.allowMethods ?? DEFAULT_METHODS).join(', ')
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    (opts.allowHeaders ?? DEFAULT_HEADERS).join(', ')
  );
  response.headers.set('Access-Control-Max-Age', String(opts.maxAge ?? DEFAULT_MAX_AGE));
}

export function withCors<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>,
  opts: CorsOptions = {}
): ApiHandler<T> {
  return async (req: NextRequest, ctx) => {
    const origin = req.headers.get('origin');

    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      setCorsHeaders(response, origin, opts);
      return response;
    }

    const response = await handler(req, ctx);
    setCorsHeaders(response, origin, opts);
    return response;
  };
}
