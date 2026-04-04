import { z } from 'zod';
import { NextResponse } from 'next/server';
import { badRequest } from './response';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type DateRangeParams = z.infer<typeof dateRangeSchema>;

export function parsePagination(
  searchParams: URLSearchParams,
  allowedSorts: string[]
): PaginationParams | NextResponse {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = paginationSchema.safeParse(raw);

  if (!parsed.success) {
    return badRequest('Invalid pagination parameters');
  }

  const { sort } = parsed.data;
  if (sort && !allowedSorts.includes(sort)) {
    return badRequest(`Invalid sort field "${sort}". Allowed: ${allowedSorts.join(', ')}`);
  }

  return parsed.data;
}

export function formatPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: { page, limit, total },
  };
}
