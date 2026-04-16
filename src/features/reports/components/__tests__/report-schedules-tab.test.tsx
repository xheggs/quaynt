import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportSchedulesTab } from '../report-schedules-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchReportSchedules = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchReportSchedules: (...args: unknown[]) => mockFetchReportSchedules(...args),
  createReportSchedule: vi.fn(),
  updateReportSchedule: vi.fn(),
  deleteReportSchedule: vi.fn(),
  triggerReportSchedule: vi.fn(),
}));

vi.mock('@/features/dashboard', () => ({
  usePromptSetOptions: () => ({
    options: [{ value: 'ps-1', label: 'SaaS Tools' }],
    isLoading: false,
  }),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

describe('ReportSchedulesTab', () => {
  it('renders empty state when no schedules', async () => {
    mockFetchReportSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    renderWithReportProviders(<ReportSchedulesTab />);

    expect(await screen.findByText('No scheduled reports')).toBeDefined();
  });

  it('renders create schedule button', async () => {
    mockFetchReportSchedules.mockResolvedValue({
      data: [
        {
          id: 'sched-1',
          workspaceId: 'ws-1',
          name: 'Weekly Report',
          promptSetId: 'ps-1',
          brandIds: ['b-1'],
          schedule: '0 9 * * MON',
          recipients: ['user@example.com'],
          format: 'pdf',
          enabled: true,
          sendIfEmpty: false,
          consecutiveFailures: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { page: 1, limit: 25, total: 1 },
    });

    renderWithReportProviders(<ReportSchedulesTab />);

    const buttons = await screen.findAllByText('Create Schedule');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    mockFetchReportSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0 },
    });

    const { container } = renderWithReportProviders(<ReportSchedulesTab />);

    await screen.findByText('No scheduled reports');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
