/**
 * Shared types for the traffic attribution module.
 *
 * The module ingests visits from two sources (snippet, server logs), classifies
 * them against the AI source dictionary, and aggregates them into daily rollups.
 * GSC data is tracked separately in the `gsc_query_performance` table (PRP 6.2c)
 * and is not a visit source.
 */

export type VisitSource = 'snippet' | 'log';

export interface AiSourceDefinition {
  /** Stable slug used in URLs, DB rows, and i18n keys (e.g. "chatgpt"). */
  platform: string;
  /** Human-readable label (e.g. "ChatGPT"). */
  displayName: string;
  /** Referrer hostnames to match (case-insensitive). */
  hosts: string[];
  /** utm_source values that also signal this platform. */
  utmSources?: string[];
  /** Compiled regex that matches either a host or utm_source, case-insensitive. */
  pattern: RegExp;
}

export interface AiSourceMatch {
  platform: string;
  displayName: string;
  /** Which signal matched: referrer host or utm_source. */
  via: 'referrer' | 'utm';
}

/**
 * Coarse user-agent families. Designed to survive anti-fingerprinting browsers
 * that freeze or spoof the full UA string.
 */
export type UserAgentFamily = 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Other';

/**
 * Payload posted by the collector snippet. Free text fields are bounded by Zod
 * validation at the route handler; the route never trusts these lengths blindly.
 */
export interface CollectorPayload {
  referrer?: string | null;
  landingPath: string;
  userAgentFamily?: string;
}

export interface VisitInsert {
  workspaceId: string;
  source: VisitSource;
  platform: string;
  referrerHost: string | null;
  landingPath: string;
  userAgentFamily: UserAgentFamily;
  siteKeyId: string | null;
  visitedAt: Date;
}

export interface CollectorResult {
  accepted: boolean;
  /** Present only when accepted. */
  platform?: string;
  /** Present only when not accepted — useful for debug logging. */
  reason?:
    | 'invalid_site_key'
    | 'revoked_site_key'
    | 'origin_not_allowed'
    | 'bot_user_agent'
    | 'not_ai_source'
    | 'dnt'
    | 'malformed_body';
}

export interface AnalyticsFilters {
  from: string;
  to: string;
  platform?: string;
  source?: VisitSource;
  siteKeyId?: string;
}

export interface AnalyticsSummary {
  totalVisits: number;
  topPlatform: string | null;
  topLandingPage: string | null;
  distinctPlatforms: number;
}

export interface TimeSeriesPoint {
  date: string;
  platform: string;
  visits: number;
}

export interface PlatformBreakdownEntry {
  platform: string;
  displayName: string;
  visits: number;
  uniquePages: number;
  lastVisit: string | null;
  /** Visit count from the prior period of equal length. */
  priorPeriodVisits: number;
}

export interface TopPageEntry {
  path: string;
  visits: number;
  platforms: string[];
}

export interface RecentVisitEntry {
  id: string;
  platform: string;
  source: VisitSource;
  landingPath: string;
  visitedAt: string;
}

export interface TrafficAggregateJobData {
  workspaceId: string;
  date: string;
}

export interface TrafficDailySummaryWebhook {
  date: string;
  totalVisits: number;
  byPlatform: Record<string, number>;
  source: VisitSource | 'all';
}
