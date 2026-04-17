import { identifyAiSource } from '@/modules/traffic/ai-source-dictionary';
import type { ParsedLogLine } from './crawler.types';

/**
 * Safely reduces a referrer URL to its lowercase hostname. Returns null when the
 * input is missing or the URL is malformed — callers treat that as "no AI signal"
 * rather than throwing.
 */
export function extractReferrerHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Classifies a parsed log line against the AI source dictionary shared with the
 * snippet collector. Log referrers never carry utm_source (UTM lives on the
 * landing URL which servers do not record as a referrer field), so the second
 * argument to identifyAiSource is always null.
 *
 * Returns the matching platform slug + lowercase hostname, or null when the
 * line carries no referrer, a malformed referrer, or a non-AI host.
 */
export function classifyLogLineForAiSource(
  parsed: ParsedLogLine
): { platform: string; referrerHost: string } | null {
  const host = extractReferrerHost(parsed.referer);
  if (!host) return null;

  const match = identifyAiSource(parsed.referer, null);
  if (!match) return null;

  return { platform: match.platform, referrerHost: host };
}
