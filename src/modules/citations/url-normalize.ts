/**
 * URL normalization and domain extraction for citation source tracking.
 *
 * Normalizes raw citation URLs into canonical forms for deduplication and
 * frequency counting. Uses the built-in URL API with no external dependencies.
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'twclid',
  'dclid',
  'yclid',
  '_ga',
  '_gl',
]);

interface NormalizedUrl {
  normalizedUrl: string;
  domain: string;
}

/**
 * Normalize a raw URL into a canonical form for deduplication.
 *
 * Transformations:
 * 1. Lowercase hostname (URL API does this)
 * 2. Strip `www.` prefix
 * 3. Remove default ports (URL API normalizes this)
 * 4. Remove tracking parameters (utm_*, fbclid, gclid, etc.)
 * 5. Sort remaining query parameters alphabetically
 * 6. Remove URL fragment
 * 7. Normalize protocol to https
 * 8. Remove trailing slash (except root path)
 *
 * Returns null for malformed URLs.
 */
export function normalizeUrl(rawUrl: string): NormalizedUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Only normalize http/https URLs
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  // Strip www. prefix from hostname
  const domain = url.hostname.startsWith('www.') ? url.hostname.slice(4) : url.hostname;

  // Force https
  url.protocol = 'https:';

  // Set the stripped hostname
  url.hostname = domain;

  // Remove tracking parameters
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  // Sort remaining query parameters
  url.searchParams.sort();

  // Remove fragment
  url.hash = '';

  // Remove trailing slash (except root path)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return {
    normalizedUrl: url.toString(),
    domain,
  };
}

/**
 * Extract the domain from a raw URL.
 *
 * Convenience wrapper that returns only the domain string,
 * or null for malformed URLs. Produces the same domain as
 * `normalizeUrl()` — lowercase hostname with `www.` stripped.
 */
export function extractDomain(rawUrl: string): string | null {
  const result = normalizeUrl(rawUrl);
  return result?.domain ?? null;
}
