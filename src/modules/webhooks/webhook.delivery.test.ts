import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/config/env', () => ({
  env: { WEBHOOK_TIMEOUT_MS: 10000, NODE_ENV: 'development' },
}));

vi.mock('./webhook.security', () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue({ valid: true }),
}));

describe('signWebhookPayload', () => {
  it('produces a verifiable HMAC-SHA256 signature', async () => {
    const { signWebhookPayload } = await import('./webhook.delivery');
    const secret = 'test-secret-key';
    const body = '{"event":"webhook.test"}';
    const deliveryId = 'whd_test123';

    const result = signWebhookPayload(deliveryId, secret, body);

    expect(result.id).toBe(deliveryId);
    expect(result.timestamp).toMatch(/^\d+$/);
    expect(result.signature).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Verify the signature is correct
    const signedContent = `${result.id}.${result.timestamp}.${body}`;
    const expected = createHmac('sha256', secret).update(signedContent).digest('hex');
    expect(result.signature).toBe(`sha256=${expected}`);
  });
});

describe('deliverWebhook', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  async function deliver(overrides = {}) {
    const { deliverWebhook } = await import('./webhook.delivery');
    return deliverWebhook({
      deliveryId: 'whd_test123',
      url: 'https://example.com/webhook',
      secret: 'test-secret',
      payload: {
        event: 'webhook.test',
        timestamp: '2026-04-02T12:00:00.000Z',
        data: { test: true },
      },
      ...overrides,
    });
  }

  it('sends POST with correct headers on success', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

    const result = await deliver();

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://example.com/webhook');
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('manual');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['User-Agent']).toBe('Quaynt-Webhooks/1.0');
    expect(options.headers['X-Quaynt-Id']).toBe('whd_test123');
    expect(options.headers['X-Quaynt-Timestamp']).toMatch(/^\d+$/);
    expect(options.headers['X-Quaynt-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('treats 3xx as failure (no redirect following)', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 301 }));

    const result = await deliver();

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(301);
    expect(result.error).toContain('301');
  });

  it('treats 4xx as failure', async () => {
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

    const result = await deliver();

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(404);
  });

  it('treats 5xx as failure', async () => {
    mockFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const result = await deliver();

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(500);
  });

  it('truncates response body to 1KB', async () => {
    const longBody = 'x'.repeat(2048);
    mockFetch.mockResolvedValue(new Response(longBody, { status: 200 }));

    const result = await deliver();

    expect(result.success).toBe(true);
    expect(result.responseBody?.length).toBe(1024);
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await deliver();

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBeNull();
    expect(result.error).toContain('fetch failed');
  });

  it('returns permanent failure for SSRF-blocked URLs', async () => {
    const { validateWebhookUrl } = await import('./webhook.security');
    vi.mocked(validateWebhookUrl).mockResolvedValueOnce({
      valid: false,
      reason: 'private IP',
    });

    const result = await deliver();

    expect(result.success).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toContain('private IP');
  });

  it('measures latency', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

    const result = await deliver();

    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
