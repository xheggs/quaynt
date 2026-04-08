import type { MetricBlock } from '@/modules/reports/report-data.types';

export interface DashboardFilters {
  promptSetId?: string;
  from?: string;
  to?: string;
}

export interface DashboardTrends {
  significantChanges: Array<{
    metric: string;
    direction: 'up' | 'down';
    pValue: number;
  }>;
  anomalies: Array<{
    metric: string;
    value: string;
    expectedRange: { lower: string; upper: string };
  }>;
}

export interface DashboardKPIs {
  recommendationShare: MetricBlock;
  totalCitations: MetricBlock;
  averageSentiment: MetricBlock;
  trends?: DashboardTrends;
}

export interface DashboardMover {
  brandId: string;
  brandName: string;
  metric: 'recommendation_share';
  current: string;
  previous: string;
  delta: string;
  direction: 'up' | 'down' | 'stable' | null;
}

export interface DashboardOpportunity {
  brandId: string;
  brandName: string;
  query: string;
  type: 'missing' | 'weak';
  competitorCount: number;
}

export interface PlatformStatus {
  adapterId: string;
  platformId: string;
  displayName: string;
  enabled: boolean;
  lastHealthStatus: string | null;
  lastHealthCheckedAt: string | null;
}

export interface DashboardAlertSummary {
  active: number;
  total: number;
  bySeverity: { info: number; warning: number; critical: number };
  recentEvents: Array<{
    id: string;
    ruleId: string;
    severity: string;
    triggeredAt: string;
    message: string;
  }>;
}

export interface DashboardPromptSet {
  id: string;
  name: string;
}

export interface DashboardPeriod {
  from: string;
  to: string;
}

export interface DashboardResponse {
  kpis: DashboardKPIs | null;
  movers: DashboardMover[] | null;
  opportunities: DashboardOpportunity[] | null;
  platforms: PlatformStatus[] | null;
  alerts: DashboardAlertSummary | null;
  dataAsOf: string;
  promptSet: DashboardPromptSet;
  period: DashboardPeriod;
  warnings?: string[];
}
