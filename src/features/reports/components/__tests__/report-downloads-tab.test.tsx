import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportDownloadsTab } from '../report-downloads-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchReportJobs = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchReportJobs: (...args: unknown[]) => mockFetchReportJobs(...args),
  buildReportDownloadUrl: vi.fn((id: string) => `/api/v1/reports/pdf/${id}/download`),
}));

describe('ReportDownloadsTab', () => {
  const onNavigateToGenerate = vi.fn();

  it('renders empty state when no reports', async () => {
    mockFetchReportJobs.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    renderWithReportProviders(<ReportDownloadsTab onNavigateToGenerate={onNavigateToGenerate} />);

    expect(await screen.findByText('No reports yet')).toBeDefined();
  });

  it('renders table with mock jobs', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockFetchReportJobs.mockResolvedValue({
      data: [
        {
          jobId: 'job-1',
          status: 'completed',
          promptSetId: 'ps-1',
          brandIds: ['b-1', 'b-2'],
          createdAt: '2026-01-15T10:00:00Z',
          completedAt: '2026-01-15T10:01:00Z',
          expiresAt: futureDate,
        },
      ],
      meta: { page: 1, limit: 25, total: 1 },
    });

    renderWithReportProviders(<ReportDownloadsTab onNavigateToGenerate={onNavigateToGenerate} />);

    expect(await screen.findByText('1 report')).toBeDefined();
    expect(screen.getByText('Download')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    mockFetchReportJobs.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    const { container } = renderWithReportProviders(
      <ReportDownloadsTab onNavigateToGenerate={onNavigateToGenerate} />
    );

    const elements = await screen.findAllByText('No reports yet');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
