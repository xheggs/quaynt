import { getReportData } from '@/modules/reports/report-data.service';
import type { ReportMetric, ReportDataResponse } from '@/modules/reports/report-data.types';
import { VALID_REPORT_METRICS } from '@/modules/reports/report-data.types';
import { listCitations } from '@/modules/citations/citation.service';
import { getRecommendationShare } from '@/modules/visibility/recommendation-share.service';
import { getSentimentAggregates } from '@/modules/visibility/sentiment-aggregate.service';
import { getPositionAggregates } from '@/modules/visibility/position-aggregate.service';
import { getOpportunities } from '@/modules/visibility/opportunity.service';
import type { ExportType, ExportFetcherResult } from './export.types';
import { MAX_EXPORT_ROWS, EXPORT_PAGE_SIZE } from './export.types';

type FetcherParams = Record<string, string | undefined>;

const ALL_PAGE = { page: 1, limit: 10000, order: 'asc' as const };

// --- Report fetcher ---

function parseMetrics(raw?: string): ReportMetric[] | undefined {
  if (!raw) return undefined;
  return raw.split(',').filter(Boolean) as ReportMetric[];
}

function* flattenReportData(
  result: ReportDataResponse,
  metricNames: ReportMetric[]
): Generator<Record<string, unknown>> {
  for (const brandData of result.brands) {
    for (const metricName of metricNames) {
      const metricKey =
        metricName === 'recommendation_share'
          ? 'recommendationShare'
          : metricName === 'citation_count'
            ? 'citationCount'
            : metricName;
      const block = brandData.metrics[metricKey as keyof typeof brandData.metrics];
      if (!block) continue;

      yield {
        brandName: brandData.brand.brandName,
        brandId: brandData.brand.brandId,
        market: result.market.name,
        periodFrom: result.period.from,
        periodTo: result.period.to,
        platform: result.filters.platformId,
        locale: result.filters.locale,
        metric: metricName,
        currentValue: block.current,
        previousValue: block.previous ?? '',
        delta: block.delta ?? '',
        changeRate: block.changeRate ?? '',
        direction: block.direction ?? '',
      };
    }
  }
}

async function fetchReport(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const brandIds = params.brandIds?.split(',').filter(Boolean);
  const metrics = parseMetrics(params.metrics);
  const filters = {
    promptSetId: params.promptSetId!,
    brandId: params.brandId,
    brandIds,
    from: params.from,
    to: params.to,
    comparisonPeriod: params.comparisonPeriod as
      | 'previous_period'
      | 'previous_week'
      | 'previous_month'
      | undefined,
    metrics,
    platformId: params.platformId,
    locale: params.locale,
  };

  const result = await getReportData(workspaceId, filters);
  const metricNames = metrics ?? [...VALID_REPORT_METRICS];
  const rows = flattenReportData(result, metricNames);

  return {
    rows: toAsyncIterable(rows),
    warnings: result.warnings,
  };
}

// --- Citations fetcher ---

async function fetchCitations(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const filters = {
    brandId: params.brandId,
    platformId: params.platformId,
    citationType: params.citationType as 'owned' | 'earned' | undefined,
    locale: params.locale,
    sentimentLabel: params.sentimentLabel as 'positive' | 'neutral' | 'negative' | undefined,
    from: params.from,
    to: params.to,
  };

  let truncated = false;

  async function* generate() {
    let page = 1;
    let emitted = 0;

    while (emitted < MAX_EXPORT_ROWS) {
      const { items } = await listCitations(workspaceId, filters, {
        page,
        limit: EXPORT_PAGE_SIZE,
        order: 'asc',
      });

      if (items.length === 0) break;

      for (const item of items) {
        if (emitted >= MAX_EXPORT_ROWS) {
          truncated = true;
          return;
        }
        // Extract domain from sourceUrl since it's not in the selected fields
        let domain = '';
        try {
          domain = new URL(item.sourceUrl).hostname;
        } catch {
          // sourceUrl may not be a valid URL
        }

        yield {
          brandId: item.brandId,
          platform: item.platformId,
          citationType: item.citationType,
          title: item.title ?? '',
          sourceUrl: item.sourceUrl,
          domain,
          position: item.position,
          contextSnippet: item.contextSnippet ?? '',
          relevanceSignal: item.relevanceSignal,
          sentimentLabel: item.sentimentLabel ?? '',
          sentimentScore: item.sentimentScore ?? '',
          locale: item.locale ?? '',
          createdAt:
            item.createdAt instanceof Date
              ? item.createdAt.toISOString().slice(0, 10)
              : String(item.createdAt ?? ''),
        };
        emitted++;
      }

      if (items.length < EXPORT_PAGE_SIZE) break;
      page++;
    }
  }

  return {
    rows: generate(),
    get truncated() {
      return truncated;
    },
  };
}

// --- Opportunities fetcher ---

async function fetchOpportunitiesExport(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const filters = {
    promptSetId: params.promptSetId!,
    brandId: params.brandId!,
    type: params.type as 'missing' | 'weak' | undefined,
    platformId: params.platformId,
    from: params.from,
    to: params.to,
  };

  let truncated = false;

  async function* generate() {
    let page = 1;
    let emitted = 0;

    while (emitted < MAX_EXPORT_ROWS) {
      const { items } = await getOpportunities(workspaceId, filters, {
        page,
        limit: EXPORT_PAGE_SIZE,
        order: 'asc',
      });

      if (items.length === 0) break;

      for (const item of items) {
        if (emitted >= MAX_EXPORT_ROWS) {
          truncated = true;
          return;
        }
        yield {
          brandId: item.brandId,
          promptText: item.promptText ?? '',
          type: item.type,
          score: item.score,
          competitorCount: item.competitorCount,
          brandCitationCount: item.brandCitationCount,
          periodStart: item.periodStart,
          platform: item.platformCount > 0 ? `${item.platformCount} platforms` : '',
        };
        emitted++;
      }

      if (items.length < EXPORT_PAGE_SIZE) break;
      page++;
    }
  }

  return {
    rows: generate(),
    get truncated() {
      return truncated;
    },
  };
}

// --- Recommendation share fetcher ---

async function fetchRecShare(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const filters = {
    promptSetId: params.promptSetId!,
    brandId: params.brandId,
    platformId: params.platformId,
    locale: params.locale,
    from: params.from,
    to: params.to,
  };

  const { items } = await getRecommendationShare(workspaceId, filters, ALL_PAGE);

  async function* generate() {
    for (const item of items) {
      yield {
        brandId: item.brandId,
        platform: item.platformId,
        locale: item.locale,
        periodStart: item.periodStart,
        sharePercentage: item.sharePercentage,
        citationCount: item.citationCount,
        totalCitations: item.totalCitations,
      };
    }
  }

  return { rows: generate() };
}

// --- Sentiment fetcher ---

async function fetchSentiment(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const filters = {
    promptSetId: params.promptSetId!,
    brandId: params.brandId,
    platformId: params.platformId,
    locale: params.locale,
    from: params.from,
    to: params.to,
  };

  const { items } = await getSentimentAggregates(workspaceId, filters, ALL_PAGE);

  async function* generate() {
    for (const item of items) {
      yield {
        brandId: item.brandId,
        platform: item.platformId,
        locale: item.locale,
        periodStart: item.periodStart,
        positiveCount: item.positiveCount,
        neutralCount: item.neutralCount,
        negativeCount: item.negativeCount,
        netSentimentScore: item.netSentimentScore,
      };
    }
  }

  return { rows: generate() };
}

// --- Positions fetcher ---

async function fetchPositions(
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  const filters = {
    promptSetId: params.promptSetId!,
    brandId: params.brandId,
    platformId: params.platformId,
    locale: params.locale,
    from: params.from,
    to: params.to,
  };

  const { items } = await getPositionAggregates(workspaceId, filters, ALL_PAGE);

  async function* generate() {
    for (const item of items) {
      yield {
        brandId: item.brandId,
        platform: item.platformId,
        locale: item.locale,
        periodStart: item.periodStart,
        citationCount: item.citationCount,
        averagePosition: item.averagePosition,
        medianPosition: item.medianPosition,
        firstMentionRate: item.firstMentionRate,
        topThreeRate: item.topThreeRate,
      };
    }
  }

  return { rows: generate() };
}

// --- Helpers ---

async function* toAsyncIterable<T>(iterable: Iterable<T>): AsyncGenerator<T> {
  for (const item of iterable) {
    yield item;
  }
}

// --- Fetcher registry ---

type FetcherFn = (workspaceId: string, params: FetcherParams) => Promise<ExportFetcherResult>;

const fetchers: Record<ExportType, FetcherFn> = {
  report: fetchReport,
  citations: fetchCitations,
  opportunities: fetchOpportunitiesExport,
  'recommendation-share': fetchRecShare,
  sentiment: fetchSentiment,
  positions: fetchPositions,
};

/**
 * Fetch export data for the given type and parameters.
 * Returns an async iterable of rows, optional warnings, and truncation flag.
 */
export function fetchExportData(
  type: ExportType,
  workspaceId: string,
  params: FetcherParams
): Promise<ExportFetcherResult> {
  return fetchers[type](workspaceId, params);
}
