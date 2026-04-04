import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/config/env';
import type { ApiHandler } from './types';

function getAllowedOrigins(): string[] {
  return env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
}

function setCorsHeaders(response: NextResponse, origin: string | null): void {
  const origins = getAllowedOrigins();
  const isWildcard = origins.length === 1 && origins[0] === '*';

  if (isWildcard) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && origins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  } else {
    return;
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Workspace-Id, X-Request-Id'
  );
  response.headers.set('Access-Control-Max-Age', '86400');
}

export function withCors<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return async (req: NextRequest, ctx) => {
    const origin = req.headers.get('origin');

    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      setCorsHeaders(response, origin);
      return response;
    }

    const response = await handler(req, ctx);
    setCorsHeaders(response, origin);
    return response;
  };
}
