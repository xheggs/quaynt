import {
  ApiError,
  type ApiErrorResponse,
  type PaginatedResponse,
  type QueryFilters,
} from './types';

const API_BASE = '/api/v1';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Typed fetch wrapper for the Quaynt API.
 *
 * - Prepends `/api/v1` base path
 * - Sets JSON content type and includes credentials
 * - On success (2xx): returns parsed response body
 * - On error (4xx/5xx): throws `ApiError` with parsed error details
 * - On network failure: throws `ApiError` with `NETWORK_ERROR` code
 */
export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const { body, headers, ...rest } = options ?? {};

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'NETWORK_ERROR', 0);
  }

  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }
    const json = await response.json();
    // Unwrap standard API envelope: { data: T } → T
    if (json && typeof json === 'object' && 'data' in json && Object.keys(json).length === 1) {
      return json.data as T;
    }
    return json as T;
  }

  // Redirect to sign-in on 401 (unauthenticated)
  if (response.status === 401 && typeof window !== 'undefined') {
    const locale = window.location.pathname.split('/')[1] || 'en';
    window.location.href = `/${locale}/sign-in`;
    // Return a never-resolving promise to prevent further processing
    return new Promise<T>(() => {});
  }

  // Parse error response
  let errorBody: ApiErrorResponse;
  try {
    errorBody = await response.json();
  } catch {
    throw new ApiError('UNKNOWN', 'UNKNOWN', response.status);
  }

  const { code, message, details } = errorBody.error;
  throw new ApiError(code, message, response.status, details);
}

/**
 * Convenience wrapper for paginated list endpoints.
 * Appends filter/pagination params as query string.
 */
export async function apiFetchPaginated<T>(
  path: string,
  params?: QueryFilters & Record<string, unknown>
): Promise<PaginatedResponse<T>> {
  const searchParams = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
  }

  const queryString = searchParams.toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;

  return apiFetch<PaginatedResponse<T>>(fullPath);
}
