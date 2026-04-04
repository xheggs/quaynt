// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { paginationSchema, parsePagination, formatPaginatedResponse } from './pagination';

describe('paginationSchema', () => {
  it('applies defaults', () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, limit: 25, order: 'desc' });
  });

  it('coerces strings to numbers', () => {
    const result = paginationSchema.parse({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('rejects page less than 1', () => {
    const result = paginationSchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 100', () => {
    const result = paginationSchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('accepts sort and order', () => {
    const result = paginationSchema.parse({ sort: 'createdAt', order: 'asc' });
    expect(result.sort).toBe('createdAt');
    expect(result.order).toBe('asc');
  });
});

describe('parsePagination', () => {
  it('returns typed pagination for valid params', () => {
    const params = new URLSearchParams({ page: '2', limit: '10' });
    const result = parsePagination(params, ['createdAt', 'name']);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    }
  });

  it('returns defaults for empty params', () => {
    const params = new URLSearchParams();
    const result = parsePagination(params, ['createdAt']);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
      expect(result.order).toBe('desc');
    }
  });

  it('returns 400 for invalid sort field', () => {
    const params = new URLSearchParams({ sort: 'invalid' });
    const result = parsePagination(params, ['createdAt', 'name']);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it('accepts valid sort field', () => {
    const params = new URLSearchParams({ sort: 'name', order: 'asc' });
    const result = parsePagination(params, ['createdAt', 'name']);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.sort).toBe('name');
      expect(result.order).toBe('asc');
    }
  });
});

describe('formatPaginatedResponse', () => {
  it('returns correct shape', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = formatPaginatedResponse(items, 50, 1, 25);

    expect(result).toEqual({
      data: items,
      meta: { page: 1, limit: 25, total: 50 },
    });
  });

  it('handles empty data', () => {
    const result = formatPaginatedResponse([], 0, 1, 25);
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});
