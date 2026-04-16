import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ScheduleFormDialog } from '../schedule-form-dialog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

vi.mock('../../reports.api', () => ({
  createReportSchedule: vi.fn(),
  updateReportSchedule: vi.fn(),
}));

vi.mock('@/features/dashboard', () => ({
  usePromptSetOptions: () => ({
    options: [{ value: 'ps-1', label: 'SaaS Tools' }],
    isLoading: false,
  }),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({
    data: [{ id: 'b-1', name: 'Brand A' }],
    meta: { page: 1, limit: 100, total: 1 },
  }),
}));

describe('ScheduleFormDialog', () => {
  const onOpenChange = vi.fn();

  it('renders create mode with empty form', () => {
    renderWithReportProviders(<ScheduleFormDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getAllByText('Create Schedule').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('Weekly visibility report')).toBeDefined();
  });

  it('renders edit mode with pre-filled values', () => {
    const schedule = {
      id: 'sched-1',
      workspaceId: 'ws-1',
      name: 'My Weekly Report',
      description: 'Weekly visibility overview',
      promptSetId: 'ps-1',
      brandIds: ['b-1'],
      schedule: '0 9 * * MON',
      recipients: ['user@example.com'],
      format: 'pdf' as const,
      enabled: true,
      sendIfEmpty: false,
      consecutiveFailures: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    renderWithReportProviders(
      <ScheduleFormDialog schedule={schedule} open={true} onOpenChange={onOpenChange} />
    );

    expect(screen.getAllByText('Edit Schedule').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('My Weekly Report')).toBeDefined();
  });

  it('renders cron preset buttons', () => {
    renderWithReportProviders(<ScheduleFormDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getAllByText('Daily at 9:00 AM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Weekly on Monday').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Monthly on the 1st').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recipient input', () => {
    renderWithReportProviders(<ScheduleFormDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getAllByPlaceholderText('email@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Add recipient').length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(
      <ScheduleFormDialog open={true} onOpenChange={onOpenChange} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
