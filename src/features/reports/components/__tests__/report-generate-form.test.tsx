import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportGenerateForm } from '../report-generate-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

vi.mock('../../reports.api', () => ({
  generatePdfReport: vi.fn(),
  buildExportUrl: vi.fn(() => '/api/v1/exports?type=report&format=csv'),
}));

vi.mock('@/features/dashboard', () => ({
  usePromptSetOptions: () => ({
    options: [{ value: 'ps-1', label: 'SaaS Tools' }],
    isLoading: false,
  }),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({
    data: [
      { id: 'b-1', name: 'Brand A' },
      { id: 'b-2', name: 'Brand B' },
    ],
    meta: { page: 1, limit: 100, total: 2 },
  }),
}));

describe('ReportGenerateForm', () => {
  const onJobCreated = vi.fn();

  it('renders form with all sections', () => {
    renderWithReportProviders(<ReportGenerateForm onJobCreated={onJobCreated} />);
    expect(screen.getAllByText('Generate Report').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Date Range').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Format').length).toBeGreaterThanOrEqual(1);
  });

  it('renders format radio options', () => {
    renderWithReportProviders(<ReportGenerateForm onJobCreated={onJobCreated} />);
    expect(screen.getAllByText('PDF Report').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CSV Spreadsheet').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JSON Data').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JSONL Stream').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Generate PDF as default submit label', () => {
    renderWithReportProviders(<ReportGenerateForm onJobCreated={onJobCreated} />);
    expect(screen.getAllByText('Generate PDF').length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(
      <ReportGenerateForm onJobCreated={onJobCreated} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
