import { NextResponse } from 'next/server';

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiCreated<T>(data: T): NextResponse {
  return apiSuccess(data, 201);
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined && { details }) } },
    { status }
  );
}

/**
 * The helpers below default `message` to the error code when no message is
 * supplied. API error codes are machine-readable and do not require i18n
 * (see .claude/rules/i18n.md). For user-facing errors, callers MUST pass an
 * already-translated message, e.g.:
 *
 *   const t = await getTranslations('errors.api');
 *   return badRequest(t('badRequest'));
 */

export function badRequest(message?: string, details?: unknown): NextResponse {
  return apiError('BAD_REQUEST', message ?? 'BAD_REQUEST', 400, details);
}

export function unauthorized(message?: string): NextResponse {
  return apiError('UNAUTHORIZED', message ?? 'UNAUTHORIZED', 401);
}

export function forbidden(message?: string): NextResponse {
  return apiError('FORBIDDEN', message ?? 'FORBIDDEN', 403);
}

export function notFound(message?: string): NextResponse {
  return apiError('NOT_FOUND', message ?? 'NOT_FOUND', 404);
}

export function conflict(message?: string): NextResponse {
  return apiError('CONFLICT', message ?? 'CONFLICT', 409);
}

export function unprocessable(details?: unknown, message?: string): NextResponse {
  return apiError('UNPROCESSABLE_ENTITY', message ?? 'UNPROCESSABLE_ENTITY', 422, details);
}

export function tooManyRequests(retryAfter?: number, message?: string): NextResponse {
  const response = apiError('TOO_MANY_REQUESTS', message ?? 'TOO_MANY_REQUESTS', 429);
  if (retryAfter !== undefined) {
    response.headers.set('Retry-After', String(retryAfter));
  }
  return response;
}
