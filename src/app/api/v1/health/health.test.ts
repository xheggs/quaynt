import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/v1/health', () => {
  it('returns 200 with healthy status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.status).toBe('healthy');
    expect(body.data.version).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });
});
