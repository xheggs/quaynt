import { describe, it, expect } from 'vitest';
import {
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
} from './response';

describe('apiSuccess', () => {
  it('returns 200 with data envelope', async () => {
    const response = apiSuccess({ id: '1' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { id: '1' } });
  });

  it('supports custom status code', async () => {
    const response = apiSuccess({ id: '1' }, 202);
    expect(response.status).toBe(202);
  });
});

describe('apiCreated', () => {
  it('returns 201 with data envelope', async () => {
    const response = apiCreated({ id: '1' });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ data: { id: '1' } });
  });
});

describe('apiNoContent', () => {
  it('returns 204 with no body', () => {
    const response = apiNoContent();
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });
});

describe('apiError', () => {
  it('returns error envelope with code and message', async () => {
    const response = apiError('TEST_ERROR', 'Something went wrong', 400);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: 'TEST_ERROR', message: 'Something went wrong' },
    });
  });

  it('includes details when provided', async () => {
    const response = apiError('TEST', 'msg', 422, { field: 'name' });
    const body = await response.json();
    expect(body.error.details).toEqual({ field: 'name' });
  });
});

describe('pre-built error helpers', () => {
  it('badRequest returns 400', async () => {
    const response = badRequest();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('badRequest accepts custom message and details', async () => {
    const response = badRequest('Invalid input', { field: 'email' });
    const body = await response.json();
    expect(body.error.message).toBe('Invalid input');
    expect(body.error.details).toEqual({ field: 'email' });
  });

  it('unauthorized returns 401', async () => {
    const response = unauthorized();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('forbidden returns 403', async () => {
    const response = forbidden();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('notFound returns 404', async () => {
    const response = notFound();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('notFound includes resource name', async () => {
    const response = notFound('API key');
    const body = await response.json();
    expect(body.error.message).toBe('API key was not found');
  });

  it('conflict returns 409', async () => {
    const response = conflict();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('unprocessable returns 422', async () => {
    const response = unprocessable([{ field: 'name', message: 'required' }]);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(body.error.details).toEqual([{ field: 'name', message: 'required' }]);
  });

  it('tooManyRequests returns 429', async () => {
    const response = tooManyRequests();
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('tooManyRequests includes Retry-After header', () => {
    const response = tooManyRequests(60);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
