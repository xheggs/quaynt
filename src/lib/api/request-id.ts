import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { ApiHandler } from './types';

const requestIdMap = new WeakMap<Request, string>();

export function getRequestId(req: Request): string | undefined {
  return requestIdMap.get(req);
}

export function withRequestId<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return async (req: NextRequest, ctx) => {
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    requestIdMap.set(req, requestId);

    const response = await handler(req, ctx);
    response.headers.set('X-Request-Id', requestId);
    return response;
  };
}
