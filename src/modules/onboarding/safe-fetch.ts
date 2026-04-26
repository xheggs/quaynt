import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import { registrableDomain } from './domain';

export const ONBOARDING_USER_AGENT = 'Quaynt-Onboarding/1.0 (+https://quaynt.com/bot)';

export type SafeFetchErrorCode =
  | 'dns_error'
  | 'ssrf_rejected'
  | 'timeout'
  | 'too_many_redirects'
  | 'redirect_off_origin'
  | 'fetch_failed'
  | 'body_too_large'
  | 'non_ok_status';

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  readonly status?: number;
  constructor(code: SafeFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
    this.status = status;
  }
}

export type SafeFetchOptions = {
  /** Connect / read timeout per hop, ms. Default 5000. */
  timeoutMs?: number;
  /** Hard max body size in bytes. Default 1 MB. */
  maxBytes?: number;
  /** Max redirects to follow. Default 3. */
  maxRedirects?: number;
  /** Override headers. UA is always set. */
  headers?: Record<string, string>;
  /** Accept header. Default text/html, xhtml, then * with q=0.5. */
  accept?: string;
  /** If true, allow non-2xx response to be returned (still subject to redirect cap). Default false. */
  allowNonOk?: boolean;
  /**
   * @internal Test hook to swap the IP filter so tests can target a local
   * server (which would otherwise be rejected as 127.0.0.1). Production
   * callers must never pass this — the default is the real `isRejectedIp`.
   */
  ipFilter?: (address: string) => boolean;
};

export type SafeFetchResult = {
  status: number;
  finalUrl: string;
  contentType: string | null;
  /** Body bytes (already size-capped). */
  body: Buffer;
  /** Body decoded as utf-8 (best-effort). Empty if not text. */
  text: string;
};

/**
 * Outbound fetch hardened against SSRF and DNS rebinding.
 *
 * Defenses:
 *  1. Resolves *all* A/AAAA records and rejects if any IP is in a private,
 *     loopback, link-local, ULA, multicast, or otherwise non-public range.
 *  2. Pins the validated IP for the actual TCP connection via undici's
 *     `connect.lookup` hook. A naive "validate then re-fetch by hostname"
 *     pattern is vulnerable to DNS rebinding because the second resolution at
 *     connect-time can return a different IP. SNI still uses the hostname so
 *     TLS verification works.
 *  3. Re-runs the full pipeline on every redirect (the same checks apply).
 *  4. Enforces per-hop timeout, total max redirects, body-size cap, and
 *     same-registrable-domain redirects.
 *
 * Returns the response body fully buffered up to `maxBytes`. Streaming is
 * intentionally *not* exposed — callers (the extractor, robots) want the whole
 * body anyway, and capping inside this module keeps the SSRF guarantee local.
 */
export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxBytes = opts.maxBytes ?? 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  const accept = opts.accept ?? 'text/html,application/xhtml+xml,*/*;q=0.5';
  const ipFilter = opts.ipFilter ?? isRejectedIp;

  let currentUrl: URL;
  try {
    currentUrl = new URL(url);
  } catch {
    throw new SafeFetchError('fetch_failed', 'Invalid URL');
  }
  const originRegistrable = registrableDomain(currentUrl.hostname);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (currentUrl.protocol !== 'https:' && currentUrl.protocol !== 'http:') {
      throw new SafeFetchError('fetch_failed', `Unsupported protocol: ${currentUrl.protocol}`);
    }
    if (hop > 0) {
      const newRegistrable = registrableDomain(currentUrl.hostname);
      if (newRegistrable !== originRegistrable) {
        throw new SafeFetchError(
          'redirect_off_origin',
          `Redirect to different registrable domain: ${newRegistrable}`
        );
      }
    }

    const records = await resolveAll(currentUrl.hostname);
    if (records.length === 0) {
      throw new SafeFetchError('dns_error', `No DNS records for ${currentUrl.hostname}`);
    }
    for (const rec of records) {
      if (ipFilter(rec.address)) {
        throw new SafeFetchError(
          'ssrf_rejected',
          `Resolved IP ${rec.address} is in a rejected range`
        );
      }
    }
    const pinned = records[0]!;

    const dispatcher = new Agent({
      connectTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
      connect: {
        // Pin DNS to the validated IP. SNI still uses the URL hostname.
        // Handle both single (`{ all: false }`) and array (`{ all: true }`)
        // callback shapes — undici may use either depending on version.
        lookup: (_hostname, options, callback) => {
          const opts = (typeof options === 'object' && options !== null ? options : {}) as {
            all?: boolean;
          };
          if (opts.all) {
            (
              callback as (
                err: Error | null,
                addresses: { address: string; family: number }[]
              ) => void
            )(null, [{ address: pinned.address, family: pinned.family }]);
          } else {
            (callback as (err: Error | null, address: string, family: number) => void)(
              null,
              pinned.address,
              pinned.family
            );
          }
        },
      },
    });

    const ac = new AbortController();
    const timeoutHandle = setTimeout(() => ac.abort(), timeoutMs);
    let response: Response;
    try {
      response = (await undiciFetch(currentUrl.toString(), {
        dispatcher,
        redirect: 'manual',
        signal: ac.signal,
        headers: {
          'user-agent': ONBOARDING_USER_AGENT,
          accept,
          ...opts.headers,
        },
      })) as unknown as Response;
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new SafeFetchError('timeout', `Timed out after ${timeoutMs}ms`);
      }
      const err = e as Error & { cause?: Error };
      const causeMsg = err.cause ? `: ${err.cause.message}` : '';
      throw new SafeFetchError('fetch_failed', `${err.message}${causeMsg}`);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (loc) {
        try {
          currentUrl = new URL(loc, currentUrl);
        } catch {
          throw new SafeFetchError('fetch_failed', `Invalid Location header: ${loc}`);
        }
        // Drain body to free the socket
        await response.arrayBuffer().catch(() => undefined);
        await dispatcher.close().catch(() => undefined);
        continue;
      }
      // 3xx without Location — treat as final
    }

    if (!opts.allowNonOk && (response.status < 200 || response.status >= 300)) {
      await response.arrayBuffer().catch(() => undefined);
      await dispatcher.close().catch(() => undefined);
      throw new SafeFetchError(
        'non_ok_status',
        `Upstream returned ${response.status}`,
        response.status
      );
    }

    const body = await readBodyCapped(response, maxBytes);
    await dispatcher.close().catch(() => undefined);
    const contentType = response.headers.get('content-type');
    return {
      status: response.status,
      finalUrl: currentUrl.toString(),
      contentType,
      body,
      text: isLikelyText(contentType) ? body.toString('utf8') : '',
    };
  }

  throw new SafeFetchError('too_many_redirects', `Exceeded ${maxRedirects} redirects from ${url}`);
}

async function resolveAll(host: string): Promise<{ address: string; family: 4 | 6 }[]> {
  try {
    const all = await dns.lookup(host, { all: true });
    return all.map((r) => ({ address: r.address, family: r.family as 4 | 6 }));
  } catch (e) {
    throw new SafeFetchError('dns_error', `DNS lookup failed: ${(e as Error).message}`);
  }
}

async function readBodyCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new SafeFetchError('body_too_large', `Response exceeded ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks, total);
}

function isLikelyText(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith('text/') ||
    ct.includes('application/xhtml') ||
    ct.includes('application/xml') ||
    ct.includes('+xml') ||
    ct.includes('application/json')
  );
}

/**
 * Return true if the IP is in any range we never want to connect to from a
 * server-side fetch. Covers loopback, private, link-local, ULA, multicast,
 * reserved, and shared address space (CGNAT).
 */
export function isRejectedIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isRejectedIpv4(address);
  if (family === 6) return isRejectedIpv6(address);
  return true; // unparseable
}

function isRejectedIpv4(address: string): boolean {
  const parts = address.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT / shared)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24, 192.0.2.0/24
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (multicast) + 240.0.0.0/4 (reserved/E)
  if (a >= 224) return true;
  return false;
}

function isRejectedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  // ::1 (loopback) and :: (unspecified)
  if (lower === '::1' || lower === '::') return true;
  // IPv4-mapped (::ffff:a.b.c.d) — extract embedded v4 and check
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isRejectedIpv4(v4Mapped[1]!);
  // IPv4-compat (::a.b.c.d)
  const v4Compat = lower.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Compat) return isRejectedIpv4(v4Compat[1]!);
  // Expand high bits enough to test prefixes
  const firstHextet = parseHextet(lower.split(':')[0] ?? '');
  // fc00::/7 (ULA): 1111110x...
  if ((firstHextet & 0xfe00) === 0xfc00) return true;
  // fe80::/10 (link-local): 1111111010...
  if ((firstHextet & 0xffc0) === 0xfe80) return true;
  // ff00::/8 (multicast)
  if ((firstHextet & 0xff00) === 0xff00) return true;
  return false;
}

function parseHextet(hex: string): number {
  if (!hex) return 0;
  const n = parseInt(hex, 16);
  return Number.isNaN(n) ? 0 : n;
}
