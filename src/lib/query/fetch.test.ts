import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, apiFetchPaginated } from './fetch';
import { ApiError } from './types';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '1', name: 'Test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // apiFetch unwraps the { data: T } envelope automatically
    const result = await apiFetch<{ id: string; name: string }>('/brands');
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('handles 204 No Content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await apiFetch('/brands/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiError on 4xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Brand not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    try {
      await apiFetch('/brands/999');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('NOT_FOUND');
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError with NETWORK_ERROR on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await apiFetch('/brands');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('NETWORK_ERROR');
    }
  });

  it('includes field-level error details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Validation failed',
            details: [{ field: 'name', message: 'Name is required' }],
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    );

    try {
      await apiFetch('/brands', { method: 'POST', body: {} });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.code).toBe('UNPROCESSABLE_ENTITY');
      expect(err.details).toHaveLength(1);
      expect(err.details![0].field).toBe('name');
    }
  });
});

describe('apiFetchPaginated', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appends query params and returns paginated response', async () => {
    const mockData = {
      data: [{ id: '1' }],
      meta: { page: 1, limit: 25, total: 1 },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await apiFetchPaginated('/brands', { page: 1, limit: 25 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);

    const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('limit=25');
  });

  it('skips undefined params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], meta: { page: 1, limit: 25, total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await apiFetchPaginated('/brands', { page: 1 });

    const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).not.toContain('search');
  });
});
