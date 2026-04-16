export type BotCategory = 'search' | 'training' | 'user_action';

export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CrawlerUpload {
  id: string;
  workspaceId: string;
  filename: string;
  format: string;
  sizeBytes: number;
  contentHash: string;
  status: UploadStatus;
  linesTotal: number | null;
  linesParsed: number | null;
  linesSkipped: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface AnalyticsFilters {
  from: string;
  to: string;
  botName?: string;
  botCategory?: BotCategory;
}

export interface PushVisitResult {
  accepted: number;
  rejected: number;
  errors?: Array<{ index: number; message: string }>;
}
