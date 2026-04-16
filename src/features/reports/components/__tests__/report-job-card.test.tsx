import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportJobCard } from '../report-job-card';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchReportJob = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchReportJob: (...args: unknown[]) => mockFetchReportJob(...args),
  buildReportDownloadUrl: vi.fn((id: string) => `/api/v1/reports/pdf/${id}/download`),
}));

describe('ReportJobCard', () => {
  const onDismiss = vi.fn();

  it('renders processing state', async () => {
    mockFetchReportJob.mockResolvedValue({
      jobId: 'job-1',
      status: 'processing',
      promptSetId: 'ps-1',
      brandIds: ['b-1'],
      createdAt: '2026-01-01T00:00:00Z',
    });

    renderWithReportProviders(<ReportJobCard jobId="job-1" onDismiss={onDismiss} />);

    expect(await screen.findByText('Generating your report...')).toBeDefined();
  });

  it('renders completed state with download button', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    mockFetchReportJob.mockResolvedValue({
      jobId: 'job-2',
      status: 'completed',
      promptSetId: 'ps-1',
      brandIds: ['b-1'],
      createdAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      expiresAt: futureDate,
    });

    renderWithReportProviders(<ReportJobCard jobId="job-2" onDismiss={onDismiss} />);

    expect(await screen.findByText('Report is ready for download')).toBeDefined();
    expect(screen.getByText('Download Report')).toBeDefined();
  });

  it('renders failed state with dismiss button', async () => {
    mockFetchReportJob.mockResolvedValue({
      jobId: 'job-3',
      status: 'failed',
      promptSetId: 'ps-1',
      brandIds: ['b-1'],
      createdAt: '2026-01-01T00:00:00Z',
      error: 'Template not found',
    });

    renderWithReportProviders(<ReportJobCard jobId="job-3" onDismiss={onDismiss} />);

    expect(await screen.findByText(/Report generation failed/)).toBeDefined();
    expect(screen.getByText('Dismiss')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    mockFetchReportJob.mockResolvedValue({
      jobId: 'job-4',
      status: 'processing',
      promptSetId: 'ps-1',
      brandIds: ['b-1'],
      createdAt: '2026-01-01T00:00:00Z',
    });

    const { container } = renderWithReportProviders(
      <ReportJobCard jobId="job-4" onDismiss={onDismiss} />
    );

    await screen.findByText('Generating your report...');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
