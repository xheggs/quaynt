import { promises as dns } from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import { env } from '@/lib/config/env';

const BLOCKED_IPV4_RANGES = [
  { prefix: '10.', mask: null },
  { prefix: '127.', mask: null },
  { prefix: '169.254.', mask: null },
  { prefix: '192.168.', mask: null },
];

function isBlockedIpv4(ip: string): boolean {
  if (BLOCKED_IPV4_RANGES.some((range) => ip.startsWith(range.prefix))) {
    return true;
  }

  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  const parts = ip.split('.');
  if (parts[0] === '172') {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  // Cloud metadata endpoint
  if (ip === '169.254.169.254') return true;

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback
  if (normalized === '::1') return true;

  // Unique local addresses (fc00::/7 — fc00:: through fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local (fe80::/10)
  if (normalized.startsWith('fe80')) return true;

  return false;
}

function isBlockedIp(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIpv4(ip);
  if (isIPv6(ip)) return isBlockedIpv6(ip);
  return false;
}

export async function validateWebhookUrl(
  url: string
): Promise<{ valid: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }

  // Require HTTPS in production
  if (env.NODE_ENV !== 'development' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Webhook URL must use HTTPS' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Webhook URL must use HTTPS or HTTP' };
  }

  // Reject URLs with credentials
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'Webhook URL must not contain credentials',
    };
  }

  // Skip IP validation in development
  if (env.NODE_ENV === 'development') {
    return { valid: true };
  }

  // Resolve DNS and check for private IPs
  const hostname = parsed.hostname;

  // If hostname is already an IP, check directly
  if (isIPv4(hostname) || isIPv6(hostname)) {
    if (isBlockedIp(hostname)) {
      return {
        valid: false,
        reason: 'Webhook URL must not point to a private or reserved IP address',
      };
    }
    return { valid: true };
  }

  // Resolve hostname and check all IPs
  const ips: string[] = [];

  try {
    const ipv4s = await dns.resolve4(hostname);
    ips.push(...ipv4s);
  } catch {
    // No A records — fine, try AAAA
  }

  try {
    const ipv6s = await dns.resolve6(hostname);
    ips.push(...ipv6s);
  } catch {
    // No AAAA records
  }

  if (ips.length === 0) {
    return { valid: false, reason: 'Could not resolve webhook URL hostname' };
  }

  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      return {
        valid: false,
        reason: 'Webhook URL must not point to a private or reserved IP address',
      };
    }
  }

  return { valid: true };
}
