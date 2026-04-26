import net from 'node:net';

export type NormalizeDomainOk = {
  ok: true;
  host: string;
  scheme: 'https' | 'http';
  baseUrl: string;
};

export type NormalizeDomainErr = {
  ok: false;
  code:
    | 'empty'
    | 'too_long'
    | 'invalid_url'
    | 'no_host'
    | 'is_ip'
    | 'reserved_tld'
    | 'no_dot'
    | 'invalid_label'
    | 'localhost';
  message: string;
};

export type NormalizeDomainResult = NormalizeDomainOk | NormalizeDomainErr;

const MAX_INPUT_LEN = 253; // hostname max
const MAX_LABEL_LEN = 63;
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
// Reserved/special-use TLDs that should never appear in a normalized public host.
const RESERVED_TLDS = new Set([
  'localhost',
  'local',
  'localdomain',
  'invalid',
  'test',
  'example',
  'onion',
]);

/**
 * Normalize a user-supplied domain string into a canonical host + base URL.
 *
 * Accepts inputs like `https://example.com/about`, `example.com`, `EXAMPLE.com/`, etc.
 * Rejects bare IPs, localhost, and obviously-invalid hostnames at the boundary so
 * downstream `safeFetch` only ever sees plausible public hosts. Reserved/private IP
 * defenses still happen in `safeFetch` (DNS-time), since a public-looking hostname
 * can resolve to a private IP — that case is handled there.
 */
export function normalizeDomain(input: string): NormalizeDomainResult {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return err('empty', 'Domain is required.');
  if (trimmed.length > MAX_INPUT_LEN + 32) return err('too_long', 'Domain is too long.');

  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return err('invalid_url', 'Domain is not a valid URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return err('invalid_url', 'Domain must use http or https.');
  }

  const host = url.hostname.toLowerCase();
  if (!host) return err('no_host', 'Domain is missing a hostname.');
  if (host.length > MAX_INPUT_LEN) return err('too_long', 'Hostname is too long.');

  if (host === 'localhost') return err('localhost', 'Localhost is not allowed.');
  if (net.isIP(host) !== 0) return err('is_ip', 'Bare IP addresses are not allowed.');

  const labels = host.split('.');
  if (labels.length < 2) return err('no_dot', 'Domain must include a top-level domain.');
  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL_LEN || !HOST_LABEL_RE.test(label)) {
      return err('invalid_label', `Invalid hostname label: ${label || '(empty)'}.`);
    }
  }

  const tld = labels[labels.length - 1]!;
  if (RESERVED_TLDS.has(tld)) {
    return err('reserved_tld', `Reserved top-level domain '${tld}' is not allowed.`);
  }

  return {
    ok: true,
    host,
    scheme: 'https',
    baseUrl: `https://${host}`,
  };
}

/**
 * Returns the registrable-ish domain (last two labels) for redirect-origin checks.
 * Approximation only — does not consult the Public Suffix List. Sufficient for
 * "did the redirect leave the brand's domain" guard, where worst case is being
 * slightly stricter than strictly needed for two-label public suffixes (`co.uk`).
 */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-2).join('.');
}

function err(code: NormalizeDomainErr['code'], message: string): NormalizeDomainErr {
  return { ok: false, code, message };
}
