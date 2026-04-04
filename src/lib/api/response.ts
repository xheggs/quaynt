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

export function badRequest(message?: string, details?: unknown): NextResponse {
  return apiError('BAD_REQUEST', message ?? 'The request could not be processed', 400, details);
}

export function unauthorized(message?: string): NextResponse {
  return apiError('UNAUTHORIZED', message ?? 'Authentication is required', 401);
}

export function forbidden(message?: string): NextResponse {
  return apiError('FORBIDDEN', message ?? 'You do not have permission to perform this action', 403);
}

export function notFound(resource?: string): NextResponse {
  return apiError(
    'NOT_FOUND',
    resource ? `${resource} was not found` : 'The requested resource was not found',
    404
  );
}

export function conflict(message?: string): NextResponse {
  return apiError('CONFLICT', message ?? 'The request conflicts with the current state', 409);
}

export function unprocessable(details?: unknown): NextResponse {
  return apiError('UNPROCESSABLE_ENTITY', 'The request could not be processed', 422, details);
}

export function tooManyRequests(retryAfter?: number): NextResponse {
  const response = apiError('TOO_MANY_REQUESTS', 'Too many requests, please try again later', 429);
  if (retryAfter !== undefined) {
    response.headers.set('Retry-After', String(retryAfter));
  }
  return response;
}
