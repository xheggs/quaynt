import { logger } from '@/lib/logger';
import { identifyBot } from '@/modules/crawler/crawler-bot-dictionary';
import { identifyAiSource } from './ai-source-dictionary';
import { insertVisit } from './ai-visit.service';
import { getSiteKeyByPlaintext } from './traffic-site-key.service';
import { detectUserAgentFamily } from './ua-family';
import type { CollectorPayload, CollectorResult } from './traffic.types';

const log = logger.child({ module: 'traffic-collector' });

/**
 * Extracts utm_source from a landing path that may include a query string.
 * Returns null when the landing path has no query string or no utm_source key.
 */
function extractUtmSource(landingPath: string): string | null {
  const qIndex = landingPath.indexOf('?');
  if (qIndex === -1) return null;
  const query = landingPath.slice(qIndex + 1);
  try {
    return new URLSearchParams(query).get('utm_source');
  } catch {
    return null;
  }
}

/**
 * Reduces a referrer URL to just its hostname (lowercase). Returns null for malformed
 * or missing referrers.
 */
function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface CollectorContext {
  /** The plaintext site key pulled from the URL segment. */
  siteKeyPlaintext: string;
  /** Parsed and Zod-validated payload posted by the snippet. */
  payload: CollectorPayload;
  /** Raw User-Agent header value, or the empty string. */
  userAgent: string;
  /** Value of the Origin request header (or null if missing). */
  requestOrigin: string | null;
}

/**
 * Classifies and persists an incoming visit. Callers are responsible for rate limiting
 * and for responding with 204 in all cases (even rejections) so the endpoint does not
 * leak which site keys are valid.
 *
 * IMPORTANT: The caller's request IP is NEVER passed into this function — it lives only
 * in the rate-limit layer. Persisting IPs here would violate the module's PII posture.
 */
export async function collectVisit(ctx: CollectorContext): Promise<CollectorResult> {
  const siteKey = await getSiteKeyByPlaintext(ctx.siteKeyPlaintext);
  if (!siteKey) return { accepted: false, reason: 'invalid_site_key' };

  if (siteKey.allowedOrigins.length > 0) {
    if (!ctx.requestOrigin || !siteKey.allowedOrigins.includes(ctx.requestOrigin)) {
      return { accepted: false, reason: 'origin_not_allowed' };
    }
  }

  // Drop known AI crawler bots — they belong in the crawler module, not here.
  if (ctx.userAgent && identifyBot(ctx.userAgent) !== null) {
    return { accepted: false, reason: 'bot_user_agent' };
  }

  const utmSource = extractUtmSource(ctx.payload.landingPath);
  const match = identifyAiSource(ctx.payload.referrer ?? null, utmSource);
  if (!match) return { accepted: false, reason: 'not_ai_source' };

  const userAgentFamily = detectUserAgentFamily(ctx.userAgent);

  try {
    await insertVisit({
      workspaceId: siteKey.workspaceId,
      source: 'snippet',
      platform: match.platform,
      referrerHost: referrerHost(ctx.payload.referrer ?? null),
      landingPath: ctx.payload.landingPath,
      userAgentFamily,
      siteKeyId: siteKey.id,
      visitedAt: new Date(),
    });
  } catch (err) {
    log.error({ err, siteKeyId: siteKey.id }, 'failed to insert AI visit');
    return { accepted: false, reason: 'invalid_site_key' };
  }

  log.debug(
    { siteKeyId: siteKey.id, platform: match.platform, via: match.via },
    'accepted AI visit'
  );

  return { accepted: true, platform: match.platform };
}
