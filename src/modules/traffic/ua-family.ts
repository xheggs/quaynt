import type { UserAgentFamily } from './traffic.types';

/**
 * Maps a raw user-agent string to a coarse family bucket. This is deliberately lossy —
 * a ~5-value family cannot identify individual visitors and is robust against
 * anti-fingerprinting browsers (Brave, Firefox Resist Fingerprinting) that freeze UA.
 *
 * Shared by the snippet collector and the crawler log parser so both attribution
 * paths produce identical family values.
 */
export function detectUserAgentFamily(userAgent: string): UserAgentFamily {
  if (!userAgent) return 'Other';
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/OPR\/|Opera/.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  return 'Other';
}
