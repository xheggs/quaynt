export type VisitSource = 'snippet' | 'log';

export interface AnalyticsFilters {
  from: string;
  to: string;
  platform?: string;
  source?: VisitSource;
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
  referrerHost: string | null;
  userAgentFamily: string;
  visitedAt: string;
}

export interface SiteKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: 'active' | 'revoked';
  allowedOrigins: string[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface SiteKeyCreated extends SiteKey {
  plaintextKey: string;
}

export interface VisitListFilters {
  from?: string;
  to?: string;
  platform?: string;
  source?: VisitSource;
  siteKeyId?: string;
}
