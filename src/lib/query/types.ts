/**
 * Client-side types mirroring the API's response shapes.
 * See: lib/api/pagination.ts (PaginatedResponse shape)
 * See: lib/api/response.ts (ApiErrorResponse shape)
 */

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/**
 * Typed error class for API failures.
 * Thrown by `apiFetch` on non-2xx responses and network errors.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(code: string, message: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Base filter parameters matching the server's paginationSchema + dateRangeSchema.
 * Feature modules extend this with domain-specific filters.
 */
export interface QueryFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  from?: string;
  to?: string;
  search?: string;
}
