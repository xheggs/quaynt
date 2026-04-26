import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { isRejectedIp, safeFetch } from './safe-fetch';

const allowAll = () => false;

describe('isRejectedIp', () => {
  it.each([
    '0.0.0.0',
    '10.5.5.5',
    '100.64.1.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.5',
    '203.0.113.5',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('rejects %s', (ip) => {
    expect(isRejectedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'accepts %s',
    (ip) => {
      expect(isRejectedIp(ip)).toBe(false);
    }
  );
});

describe('safeFetch — SSRF + DNS-rebinding defenses', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/redirect-off-domain') {
        res.writeHead(302, { Location: 'http://other-domain.example/' });
        res.end();
        return;
      }
      if (req.url === '/redirect-loop') {
        res.writeHead(302, { Location: '/redirect-loop' });
        res.end();
        return;
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(Buffer.alloc(2 * 1024 * 1024, 'a'));
        return;
      }
      if (req.url === '/slow') {
        // never respond — let timeout fire
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body>ok</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a hostname that resolves to a private IP', async () => {
    const dnsModule = await import('node:dns/promises');
    vi.spyOn(dnsModule.default, 'lookup').mockResolvedValue([
      { address: '10.0.0.5', family: 4 },
    ] as never);
    await expect(safeFetch('https://attacker.example/')).rejects.toMatchObject({
      code: 'ssrf_rejected',
    });
  });

  it('rejects when ANY resolved IP is private (multi-record DNS)', async () => {
    const dnsModule = await import('node:dns/promises');
    vi.spyOn(dnsModule.default, 'lookup').mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] as never);
    await expect(safeFetch('https://attacker.example/')).rejects.toMatchObject({
      code: 'ssrf_rejected',
    });
  });

  it('pins the validated IP for the actual TCP connect (DNS rebinding)', async () => {
    // The pin defense: safeFetch resolves DNS once, validates every IP, and
    // pins the chosen IP for undici's connect. There must be no second DNS
    // resolution at connect-time (where rebinding would land).
    const dnsModule = await import('node:dns/promises');
    const lookup = vi
      .spyOn(dnsModule.default, 'lookup')
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    const result = await safeFetch(`http://attacker-rebind.example:${port}/`, {
      ipFilter: allowAll,
    });
    expect(result.status).toBe(200);
    // Must be exactly 1 — if undici re-resolved at connect-time we'd see ≥ 2.
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('honors body-size cap', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${port}/big`, { maxBytes: 64 * 1024, ipFilter: allowAll })
    ).rejects.toMatchObject({ code: 'body_too_large' });
  });

  it('honors timeout', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${port}/slow`, { timeoutMs: 250, ipFilter: allowAll })
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects redirects to off-origin hosts', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${port}/redirect-off-domain`, { ipFilter: allowAll })
    ).rejects.toMatchObject({ code: 'redirect_off_origin' });
  });

  it('caps total redirects', async () => {
    await expect(
      safeFetch(`http://127.0.0.1:${port}/redirect-loop`, {
        maxRedirects: 2,
        ipFilter: allowAll,
      })
    ).rejects.toMatchObject({ code: 'too_many_redirects' });
  });

  it('rejects unsupported protocols', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toMatchObject({
      code: 'fetch_failed',
    });
  });

  it('returns body and content-type for a normal response', async () => {
    const result = await safeFetch(`http://127.0.0.1:${port}/`, { ipFilter: allowAll });
    expect(result.status).toBe(200);
    expect(result.contentType).toMatch(/text\/html/);
    expect(result.text).toContain('ok');
  });
});
