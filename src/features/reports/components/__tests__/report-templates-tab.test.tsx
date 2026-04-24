import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportTemplatesTab } from '../report-templates-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchReportTemplates = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchReportTemplates: (...args: unknown[]) => mockFetchReportTemplates(...args),
  createReportTemplate: vi.fn(),
  updateReportTemplate: vi.fn(),
  deleteReportTemplate: vi.fn(),
  duplicateReportTemplate: vi.fn(),
  uploadTemplateLogo: vi.fn(),
  deleteTemplateLogo: vi.fn(),
  fetchTemplatePreview: vi.fn(),
}));

const mockTemplate = {
  id: 'tmpl-1',
  workspaceId: 'ws-1',
  name: 'Brand Report',
  description: 'For client presentations',
  branding: {
    primaryColor: '#9B70BC',
    secondaryColor: '#1A1A1A',
    accentColor: '#2563EB',
    fontFamily: 'noto-sans' as const,
  },
  sections: {
    cover: true,
    executiveSummary: true,
    recommendationShare: true,
    competitorBenchmarks: true,
    opportunities: true,
    citationSources: true,
    alertSummary: false,
    geoScore: false,
    seoScore: false,
    dualScore: false,
    sectionOrder: [
      'cover',
      'executiveSummary',
      'recommendationShare',
      'competitorBenchmarks',
      'opportunities',
      'citationSources',
      'alertSummary',
    ],
  },
  coverOverrides: {},
  isDefault: false,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

describe('ReportTemplatesTab', () => {
  it('renders empty state when no templates', async () => {
    mockFetchReportTemplates.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    renderWithReportProviders(<ReportTemplatesTab />);

    expect(await screen.findByText('No templates yet')).toBeDefined();
  });

  it('renders table with templates', async () => {
    mockFetchReportTemplates.mockResolvedValue({
      data: [mockTemplate],
      meta: { page: 1, limit: 25, total: 1 },
    });

    renderWithReportProviders(<ReportTemplatesTab />);

    expect(await screen.findByText('Brand Report')).toBeDefined();
  });

  it('renders create template button', async () => {
    mockFetchReportTemplates.mockResolvedValue({
      data: [mockTemplate],
      meta: { page: 1, limit: 25, total: 1 },
    });

    renderWithReportProviders(<ReportTemplatesTab />);

    await screen.findByText('Brand Report');
    const buttons = screen.getAllByText('Create template');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows template count badge', async () => {
    mockFetchReportTemplates.mockResolvedValue({
      data: [mockTemplate],
      meta: { page: 1, limit: 25, total: 1 },
    });

    renderWithReportProviders(<ReportTemplatesTab />);

    expect(await screen.findByText('1 template')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    mockFetchReportTemplates.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    const { container } = renderWithReportProviders(<ReportTemplatesTab />);

    await screen.findByText('No templates yet');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
