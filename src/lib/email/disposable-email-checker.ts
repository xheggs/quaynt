import MailChecker from 'mailchecker';

/**
 * Privacy forwarders are NOT disposable — paying users rely on them
 * (Apple Hide My Email, SimpleLogin, addy.io, DuckDuckGo Email Protection).
 * Domains in this allowlist override the mailchecker blacklist.
 */
export const PRIVACY_FORWARDER_ALLOWLIST: ReadonlySet<string> = new Set([
  'privaterelay.appleid.com',
  'simplelogin.io',
  'simplelogin.com',
  'simplelogin.fr',
  'aleeas.com',
  'addy.io',
  'anonaddy.me',
  'anonaddy.com',
  'duck.com',
]);

/**
 * Returns true when the email's domain (or any parent subdomain) is on the
 * disposable-email blacklist and not on the privacy-forwarder allowlist.
 *
 * Pure, sync, no I/O. Safe to call from edge or node contexts.
 *
 * Returns false defensively for malformed input — RFC-shape validation is
 * upstream Zod's responsibility; this utility only judges disposability.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!domain) return false;

  if (PRIVACY_FORWARDER_ALLOWLIST.has(domain)) return false;

  const blacklist = MailChecker.blacklist();
  let current = domain;
  while (current) {
    if (blacklist.has(current)) return true;
    const dot = current.indexOf('.');
    if (dot === -1) return false;
    current = current.slice(dot + 1);
  }
  return false;
}
