// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateRequest } from './validation';

const mockCtx = { params: Promise.resolve({ id: 'test_123' }) };

function createRequest(options: {
  method?: string;
  path?: string;
  body?: unknown;
  query?: Record<string, string>;
}): NextRequest {
  const url = new URL(options.path ?? '/api/v1/test', 'http://localhost:3000');
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url, {
    method: options.method ?? 'POST',
    ...(options.body !== undefined
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(options.body),
        }
      : {}),
  });
}

describe('validateRequest', () => {
  describe('body validation', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      count: z.number().int(),
    });

    it('returns typed data on valid body', async () => {
      const req = createRequest({ body: { name: 'test', count: 5 } });
      const result = await validateRequest(req, mockCtx, { body: bodySchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toEqual({ name: 'test', count: 5 });
      }
    });

    it('returns 400 on invalid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      });

      const result = await validateRequest(req, mockCtx, { body: bodySchema });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const body = await result.response.json();
        expect(body.error.code).toBe('BAD_REQUEST');
      }
    });

    it('returns 422 with field details on schema violation', async () => {
      const req = createRequest({ body: { name: '', count: 'not-a-number' } });
      const result = await validateRequest(req, mockCtx, { body: bodySchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(422);
        const body = await result.response.json();
        expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
        expect(body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
          ])
        );
      }
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1),
      search: z.string().optional(),
    });

    it('returns typed data on valid query params', async () => {
      const req = createRequest({ method: 'GET', query: { page: '2', search: 'hello' } });
      const result = await validateRequest(req, mockCtx, { query: querySchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toEqual({ page: 2, search: 'hello' });
      }
    });

    it('returns 422 on invalid query params', async () => {
      const req = createRequest({ method: 'GET', query: { page: 'abc' } });
      const result = await validateRequest(req, mockCtx, { query: querySchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(422);
      }
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      id: z.string().startsWith('test_'),
    });

    it('returns typed data on valid params', async () => {
      const req = createRequest({ method: 'GET' });
      const result = await validateRequest(req, mockCtx, { params: paramsSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params).toEqual({ id: 'test_123' });
      }
    });

    it('returns 422 on invalid params', async () => {
      const req = createRequest({ method: 'GET' });
      const ctx = { params: Promise.resolve({ id: 'bad' }) };
      const result = await validateRequest(req, ctx, { params: paramsSchema });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(422);
      }
    });
  });

  it('validates multiple schemas simultaneously', async () => {
    const bodySchema = z.object({ name: z.string() });
    const querySchema = z.object({ page: z.coerce.number() });
    const paramsSchema = z.object({ id: z.string() });

    const req = createRequest({
      body: { name: 'test' },
      query: { page: '1' },
    });

    const result = await validateRequest(req, mockCtx, {
      body: bodySchema,
      query: querySchema,
      params: paramsSchema,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toEqual({ name: 'test' });
      expect(result.data.query).toEqual({ page: 1 });
      expect(result.data.params).toEqual({ id: 'test_123' });
    }
  });

  it('returns undefined for schemas not provided', async () => {
    const req = createRequest({ method: 'GET' });
    const result = await validateRequest(req, mockCtx, {});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBeUndefined();
      expect(result.data.query).toBeUndefined();
      expect(result.data.params).toBeUndefined();
    }
  });
});
