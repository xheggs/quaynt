import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { logger } from '@/lib/logger';
import { getReportData } from '@/modules/reports/report-data.service';
import type {
  ReportDataFilters,
  ReportDataResponse,
  SourceMetricBlock,
} from '@/modules/reports/report-data.types';
import { registerFonts } from './fonts';
import { renderChart } from './chart-renderer.service';
import type { BarChartData, LineChartData } from './chart-renderer.service';
import { ReportDocument } from './templates/report-document';
import type {
  PdfReportConfig,
  PdfGenerationResult,
  PdfTranslations,
  ReportDocumentProps,
} from './pdf.types';
import { PdfPermanentError, PdfTransientError } from './pdf.types';

import reportsPdfMessages from '../../../locales/en/reports-pdf.json';
import reportsMessages from '../../../locales/en/reports.json';

const log = logger.child({ module: 'pdf-generator' });

// Register fonts at module load
registerFonts();

/**
 * Load and resolve translations for the report.
 * For now, always loads English. When more locales are added,
 * this will dynamically import the correct locale file.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- locale param reserved for future multi-locale support
function loadTranslations(locale: string): PdfTranslations {
  const pdf = reportsPdfMessages.reportsPdf;
  const reports = (reportsMessages as { reports: { direction: Record<string, string> } }).reports;

  return {
    cover: pdf.cover as PdfTranslations['cover'],
    executive: pdf.executive as PdfTranslations['executive'],
    kpi: pdf.kpi,
    sections: pdf.sections,
    charts: pdf.charts,
    tables: pdf.tables,
    footer: pdf.footer as PdfTranslations['footer'],
    warnings: pdf.warnings,
    direction: reports.direction,
  };
}

/**
 * Render charts as PNG buffers based on the report data.
 */
async function renderCharts(
  reportData: ReportDataResponse,
  translations: PdfTranslations
): Promise<Record<string, Buffer>> {
  const charts: Record<string, Buffer> = {};

  try {
    // Recommendation share by platform — bar chart
    const shareData: BarChartData = {
      categories: reportData.brands.map((b) => b.brand.brandName),
      series: [
        {
          name: translations.kpi.recommendationShare,
          values: reportData.brands.map((b) =>
            b.metrics.recommendationShare ? Number(b.metrics.recommendationShare.current) : 0
          ),
        },
      ],
    };

    if (shareData.series[0].values.some((v) => v > 0)) {
      charts.shareByPlatform = await renderChart('bar', shareData, {
        title: translations.charts.shareByPlatform,
        yAxisLabel: translations.tables.share,
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to render share bar chart');
  }

  try {
    // Trend line chart — use sparkline data from primary brand
    const primaryBrand = reportData.brands[0];
    const sparkline = primaryBrand?.metrics.recommendationShare?.sparkline;
    if (sparkline && sparkline.length > 1) {
      const lineData: LineChartData = {
        dates: sparkline.map((p) => p.date),
        series: [
          {
            name: primaryBrand.brand.brandName,
            values: sparkline.map((p) => Number(p.value)),
          },
        ],
      };
      charts.shareTrend = await renderChart('line', lineData, {
        title: translations.charts.trendOverTime,
        xAxisLabel: translations.charts.axisDate,
        yAxisLabel: translations.charts.axisValue,
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to render trend line chart');
  }

  try {
    // Top domains — horizontal bar chart
    const domainMap = new Map<string, number>();
    for (const b of reportData.brands) {
      const src = b.metrics.sources as SourceMetricBlock | undefined;
      if (src?.topDomains) {
        for (const d of src.topDomains) {
          domainMap.set(d.domain, (domainMap.get(d.domain) ?? 0) + d.frequency);
        }
      }
    }

    const topDomains = [...domainMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (topDomains.length > 0) {
      const barData: BarChartData = {
        categories: topDomains.map(([domain]) => domain),
        series: [
          {
            name: translations.tables.frequency,
            values: topDomains.map(([, freq]) => freq),
          },
        ],
      };
      charts.topDomains = await renderChart('bar', barData, {
        title: translations.charts.topDomains,
        yAxisLabel: translations.tables.frequency,
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to render domains bar chart');
  }

  return charts;
}

/**
 * Ensure the report storage directory exists.
 */
function ensureStorageDir(storagePath: string): void {
  try {
    mkdirSync(storagePath, { recursive: true });
  } catch {
    throw new PdfPermanentError(`Cannot create report storage directory: ${storagePath}`);
  }
}

/**
 * Format a date for display using Intl.
 */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Generate a PDF report and write it to disk.
 *
 * Pipeline:
 * 1. Fetch report data via getReportData()
 * 2. Load i18n translations
 * 3. Render charts as PNG buffers
 * 4. Assemble React component props
 * 5. Render PDF via renderToStream()
 * 6. Write stream to file
 * 7. Return file metadata
 */
export async function generatePdfReport(config: PdfReportConfig): Promise<PdfGenerationResult> {
  const { jobId, workspaceId, workspaceName, scope, locale, storagePath } = config;

  log.info({ jobId, workspaceId, locale }, 'Starting PDF generation');

  // 1. Fetch report data
  let reportData: ReportDataResponse;
  try {
    const filters: ReportDataFilters = {
      promptSetId: scope.promptSetId,
      brandIds: scope.brandIds,
      from: scope.from,
      to: scope.to,
      comparisonPeriod: scope.comparisonPeriod as ReportDataFilters['comparisonPeriod'],
      metrics: scope.metrics as ReportDataFilters['metrics'],
      platformId: scope.platformId,
      locale,
    };
    reportData = await getReportData(workspaceId, filters);
  } catch (err) {
    log.error({ jobId, err }, 'Failed to fetch report data');
    throw new PdfTransientError(`Data fetch failed: ${(err as Error).message}`);
  }

  if (reportData.brands.length === 0) {
    throw new PdfPermanentError('No brand data found for the given scope');
  }

  // 2. Load translations
  const translations = loadTranslations(locale);

  // 3. Render charts
  const charts = await renderCharts(reportData, translations);

  // 4. Assemble template props
  const generatedAt = formatDate(new Date(), locale);

  const documentProps: ReportDocumentProps = {
    reportData,
    translations,
    charts,
    locale,
    workspaceName,
    generatedAt,
  };

  // 5. Render PDF stream
  ensureStorageDir(storagePath);
  const filePath = join(storagePath, `${jobId}.pdf`);

  const pdfStream = await renderToStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf renderToStream expects DocumentProps-typed element but ReportDocument returns Document directly
    React.createElement(ReportDocument, documentProps) as any
  );

  // 6. Write to file
  const writeStream = createWriteStream(filePath);
  await pipeline(Readable.fromWeb(pdfStream as never), writeStream);

  // 7. Get file stats
  const stats = statSync(filePath);

  log.info({ jobId, filePath, fileSizeBytes: stats.size }, 'PDF generation complete');

  return {
    filePath,
    fileSizeBytes: stats.size,
    // Page count is not easily extractable from renderToStream.
    // A reasonable estimate based on sections present.
    pageCount: 2 + Object.keys(charts).length + (reportData.brands.length > 1 ? 1 : 0),
  };
}
