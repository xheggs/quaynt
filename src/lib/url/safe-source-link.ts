/**
 * Resolves a citation source URL into a render-safe { href, label } pair.
 *
 * Citation `sourceUrl` values are user-supplied content extracted from
 * adapter responses, so they must not be rendered as a clickable `<a>`
 * without a protocol allowlist. We accept only `http:` and `https:`; every
 * other protocol — including `javascript:`, `data:`, `file:`, and unknown
 * schemes — is treated as plain text.
 *
 * Callers should render `<a href={href}>` only when `href` is present.
 * When `href` is undefined, render `label` (the parsed host or the raw
 * input) as plain text.
 */
export interface SafeSourceLink {
  /** Safe to use as `<a href>`. Undefined when the URL is unsafe or invalid. */
  href?: string;
  /** Human-readable label — falls back to a truncated raw string. */
  label: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function safeSourceLink(input: string | null | undefined): SafeSourceLink {
  if (!input) return { label: '' };

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { label: truncate(input) };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { label: parsed.host || truncate(input) };
  }

  return { href: parsed.toString(), label: parsed.host };
}

function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
