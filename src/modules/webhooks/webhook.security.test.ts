import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: { NODE_ENV: 'production' },
}));

const mockResolve4 = vi.fn();
const mockResolve6 = vi.fn();

vi.mock('node:dns', () => ({
  default: {
    promises: {
      resolve4: (...args: unknown[]) => mockResolve4(...args),
      resolve6: (...args: unknown[]) => mockResolve6(...args),
    },
  },
  promises: {
    resolve4: (...args: unknown[]) => mockResolve4(...args),
    resolve6: (...args: unknown[]) => mockResolve6(...args),
  },
}));

describe('validateWebhookUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockResolve6.mockRejectedValue(new Error('No AAAA'));
  });

  async function validate(url: string) {
    const { validateWebhookUrl } = await import('./webhook.security');
    return validateWebhookUrl(url);
  }

  it('accepts valid HTTPS URLs with public IPs', async () => {
    const result = await validate('https://example.com/webhooks');
    expect(result.valid).toBe(true);
  });

  it('rejects invalid URLs', async () => {
    const result = await validate('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid URL');
  });

  it('rejects HTTP in production', async () => {
    const result = await validate('http://example.com/webhooks');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HTTPS');
  });

  it('rejects URLs with credentials', async () => {
    const result = await validate('https://user:pass@example.com/webhooks');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('credentials');
  });

  it('rejects private IP 10.x.x.x', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1']);
    const result = await validate('https://internal.example.com/webhooks');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private');
  });

  it('rejects private IP 172.16.x.x', async () => {
    mockResolve4.mockResolvedValue(['172.16.0.1']);
    const result = await validate('https://internal.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects private IP 192.168.x.x', async () => {
    mockResolve4.mockResolvedValue(['192.168.1.1']);
    const result = await validate('https://internal.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects loopback 127.x.x.x (DNS rebinding)', async () => {
    mockResolve4.mockResolvedValue(['127.0.0.1']);
    const result = await validate('https://evil.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects cloud metadata IP 169.254.169.254', async () => {
    mockResolve4.mockResolvedValue(['169.254.169.254']);
    const result = await validate('https://metadata.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects link-local IPs', async () => {
    mockResolve4.mockResolvedValue(['169.254.1.1']);
    const result = await validate('https://linklocal.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects IPv6 loopback', async () => {
    mockResolve4.mockRejectedValue(new Error('No A'));
    mockResolve6.mockResolvedValue(['::1']);
    const result = await validate('https://v6loopback.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects IPv6 unique local addresses', async () => {
    mockResolve4.mockRejectedValue(new Error('No A'));
    mockResolve6.mockResolvedValue(['fc00::1']);
    const result = await validate('https://v6private.example.com/webhooks');
    expect(result.valid).toBe(false);
  });

  it('rejects when hostname cannot be resolved', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validate('https://nonexistent.example.com/webhooks');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('resolve');
  });

  it('rejects bare private IPs', async () => {
    const result = await validate('https://10.0.0.1/webhooks');
    expect(result.valid).toBe(false);
  });

  it('allows 172.15.x.x (not in private range)', async () => {
    mockResolve4.mockResolvedValue(['172.15.0.1']);
    const result = await validate('https://edge.example.com/webhooks');
    expect(result.valid).toBe(true);
  });
});

describe('validateWebhookUrl in development', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('allows HTTP and localhost in development', async () => {
    vi.doMock('@/lib/config/env', () => ({
      env: { NODE_ENV: 'development' },
    }));
    const { validateWebhookUrl } = await import('./webhook.security');
    const result = await validateWebhookUrl('http://localhost:3000/webhooks');
    expect(result.valid).toBe(true);
  });
});
