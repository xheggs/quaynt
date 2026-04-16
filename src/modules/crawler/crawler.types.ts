export type LogFormat = 'apache' | 'nginx' | 'cloudfront';

export type BotCategory = 'search' | 'training' | 'user_action';

export interface BotDefinition {
  name: string;
  category: BotCategory;
  operator: string;
  pattern: RegExp;
}

export interface BotMatch {
  name: string;
  category: BotCategory;
  operator: string;
}

export interface ParsedLogLine {
  ip: string;
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  responseBytes: number;
  userAgent: string;
}

export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CrawlerParseJobData {
  workspaceId: string;
  uploadId: string;
}

export interface CrawlerAggregateJobData {
  workspaceId: string;
  date: string;
}

export interface VisitInsert {
  workspaceId: string;
  uploadId: string | null;
  botName: string;
  botCategory: BotCategory;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  statusCode: number;
  responseBytes: number;
  visitedAt: Date;
}

export interface PushVisitInput {
  botName?: string;
  userAgent: string;
  requestPath: string;
  requestMethod?: string;
  statusCode?: number;
  responseBytes?: number;
  visitedAt: string;
}

export interface AnalyticsFilters {
  from: string;
  to: string;
  botName?: string;
  botCategory?: BotCategory;
}

export interface AnalyticsSummary {
  totalVisits: number;
  uniqueBots: number;
  uniquePages: number;
  activeBots: number;
}

export interface TimeSeriesPoint {
  date: string;
  botName: string;
  visits: number;
}

export interface BotBreakdownEntry {
  botName: string;
  operator: string;
  category: BotCategory;
  visits: number;
  uniquePages: number;
  lastSeen: string;
}

export interface TopPageEntry {
  path: string;
  totalVisits: number;
  botCount: number;
  lastCrawled: string;
}

export interface CoverageGapEntry {
  path: string;
  lastCrawled: string;
  daysSince: number;
}
