// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReportDataResponse } from '@/modules/reports/report-data.types';

const mockGetReportData = vi.fn();
const mockRenderChart = vi.fn();
const mockRenderToStream = vi.fn();
const mockRegisterFonts = vi.fn();

vi.mock('@/modules/reports/report-data.service', () => ({
  getReportData: (...args: unknown[]) => mockGetReportData(...args),
}));

vi.mock('./chart-renderer.service', () => ({
  renderChart: (...args: unknown[]) => mockRenderChart(...args),
}));

vi.mock('./fonts', () => ({
  registerFonts: () => mockRegisterFonts(),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToStream: (...args: unknown[]) => mockRenderToStream(...args),
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  StyleSheet: { create: (s: unknown) => s },
  Font: { register: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

vi.mock('@/lib/config/env', () => ({
  env: { REPORT_STORAGE_PATH: '/tmp/test-reports' },
}));

// Mock fs operations
const mockMkdirSync = vi.fn();
const mockCreateWriteStream = vi.fn();
const mockStatSync = vi.fn();

vi.mock('node:fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:stream', () => ({
  Readable: {
    fromWeb: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  },
}));

vi.mock('../../../locales/en/reports-pdf.json', () => ({
  default: {
    reportsPdf: {
      cover: { title: 'T', subtitle: 'S', dateRange: 'D', generatedAt: 'G', brands: 'B' },
      executive: { title: 'E', periodLabel: 'P', comparisonLabel: 'C', noChange: 'N' },
      kpi: {
        recommendationShare: 'RS',
        citationCount: 'CC',
        sentiment: 'S',
        averagePosition: 'AP',
        topSource: 'TS',
        opportunities: 'O',
      },
      sections: {
        recommendationShare: 'RS',
        competitorBenchmarks: 'CB',
        opportunities: 'OP',
        citationSources: 'CS',
        alertSummary: 'AS',
      },
      charts: {
        shareByPlatform: 'SP',
        trendOverTime: 'T',
        shareDistribution: 'SD',
        topDomains: 'TD',
        axisDate: 'D',
        axisValue: 'V',
        noData: 'ND',
      },
      tables: { brand: 'Brand', share: 'S', frequency: 'F' },
      footer: { generatedBy: 'Quaynt', page: 'P' },
      warnings: { partialData: 'PD', chartFailed: 'CF' },
    },
  },
}));

vi.mock('../../../locales/en/reports.json', () => ({
  default: {
    reports: {
      direction: { up: 'Up', down: 'Down', stable: 'Stable' },
    },
  },
}));

function makeReportData(overrides: Partial<ReportDataResponse> = {}): ReportDataResponse {
  return {
    market: { promptSetId: 'ps_1', name: 'Test Market' },
    period: { from: '2026-03-01', to: '2026-03-31', comparisonFrom: null, comparisonTo: null },
    filters: { platformId: '_all', locale: 'en' },
    brands: [
      {
        brand: { brandId: 'brand_1', brandName: 'Test Brand' },
        metrics: {
          recommendationShare: {
            current: '42.50',
            previous: '38.00',
            delta: '4.50',
            changeRate: '11.84',
            direction: 'up',
            sparkline: [
              { date: '2026-03-01', value: '38.00' },
              { date: '2026-03-15', value: '40.00' },
              { date: '2026-03-31', value: '42.50' },
            ],
          },
          citationCount: {
            current: '150',
            previous: '120',
            delta: '30',
            changeRate: '25.00',
            direction: 'up',
            sparkline: [],
          },
        },
      },
    ],
    ...overrides,
  };
}

describe('pdf-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReportData.mockResolvedValue(makeReportData());
    mockRenderChart.mockResolvedValue(Buffer.from('fake-chart-png'));

    // Mock renderToStream to return a ReadableStream-like object
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from('%PDF-1.4 fake content');
      },
    };
    mockRenderToStream.mockResolvedValue(mockStream);

    mockCreateWriteStream.mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    });

    mockStatSync.mockReturnValue({ size: 52000 });
  });

  it('generates a PDF and returns result metadata', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');

    const result = await generatePdfReport({
      jobId: 'rpt_test1',
      workspaceId: 'ws_1',
      workspaceName: 'Test Workspace',
      scope: {
        promptSetId: 'ps_1',
        brandIds: ['brand_1'],
      },
      locale: 'en',
      storagePath: '/tmp/test-reports',
    });

    expect(result.filePath).toBe('/tmp/test-reports/rpt_test1.pdf');
    expect(result.fileSizeBytes).toBe(52000);
    expect(result.pageCount).toBeGreaterThan(0);
  });

  it('calls getReportData with correct filters', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');

    await generatePdfReport({
      jobId: 'rpt_test2',
      workspaceId: 'ws_1',
      workspaceName: 'WS',
      scope: {
        promptSetId: 'ps_1',
        brandIds: ['brand_1'],
        from: '2026-03-01',
        to: '2026-03-31',
      },
      locale: 'en',
      storagePath: '/tmp/test-reports',
    });

    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_1',
      expect.objectContaining({
        promptSetId: 'ps_1',
        brandIds: ['brand_1'],
        from: '2026-03-01',
        to: '2026-03-31',
      })
    );
  });

  it('creates storage directory', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');

    await generatePdfReport({
      jobId: 'rpt_test3',
      workspaceId: 'ws_1',
      workspaceName: 'WS',
      scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
      locale: 'en',
      storagePath: '/tmp/custom-reports',
    });

    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/custom-reports', { recursive: true });
  });

  it('throws PdfTransientError on data fetch failure', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');
    const { PdfTransientError } = await import('./pdf.types');

    mockGetReportData.mockRejectedValue(new Error('DB timeout'));

    await expect(
      generatePdfReport({
        jobId: 'rpt_fail1',
        workspaceId: 'ws_1',
        workspaceName: 'WS',
        scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
        locale: 'en',
        storagePath: '/tmp/test-reports',
      })
    ).rejects.toThrow(PdfTransientError);
  });

  it('throws PdfPermanentError when no brands found', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');
    const { PdfPermanentError } = await import('./pdf.types');

    mockGetReportData.mockResolvedValue(makeReportData({ brands: [] }));

    await expect(
      generatePdfReport({
        jobId: 'rpt_fail2',
        workspaceId: 'ws_1',
        workspaceName: 'WS',
        scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
        locale: 'en',
        storagePath: '/tmp/test-reports',
      })
    ).rejects.toThrow(PdfPermanentError);
  });

  it('continues when chart rendering fails', async () => {
    const { generatePdfReport } = await import('./pdf-generator.service');

    mockRenderChart.mockRejectedValue(new Error('Chart failed'));

    // Should still succeed — charts are optional
    const result = await generatePdfReport({
      jobId: 'rpt_chartfail',
      workspaceId: 'ws_1',
      workspaceName: 'WS',
      scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
      locale: 'en',
      storagePath: '/tmp/test-reports',
    });

    expect(result.filePath).toContain('rpt_chartfail.pdf');
  });
});
