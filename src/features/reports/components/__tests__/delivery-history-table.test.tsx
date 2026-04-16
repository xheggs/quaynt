import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { DeliveryHistoryTable } from '../delivery-history-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchScheduleDeliveries = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchScheduleDeliveries: (...args: unknown[]) => mockFetchScheduleDeliveries(...args),
}));

describe('DeliveryHistoryTable', () => {
  it('renders empty state when no deliveries', async () => {
    mockFetchScheduleDeliveries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 5, total: 0 },
    });

    renderWithReportProviders(<DeliveryHistoryTable scheduleId="sched-1" />);

    expect(await screen.findByText('No deliveries yet')).toBeDefined();
  });

  it('renders deliveries', async () => {
    mockFetchScheduleDeliveries.mockResolvedValue({
      data: [
        {
          id: 'del-1',
          scheduleId: 'sched-1',
          status: 'sent',
          format: 'pdf',
          recipientCount: 3,
          sentAt: '2026-01-15T09:00:00Z',
          createdAt: '2026-01-15T09:00:00Z',
        },
        {
          id: 'del-2',
          scheduleId: 'sched-1',
          status: 'failed',
          format: 'pdf',
          recipientCount: 3,
          failureReason: 'SMTP connection timeout',
          createdAt: '2026-01-08T09:00:00Z',
        },
      ],
      meta: { page: 1, limit: 5, total: 2 },
    });

    renderWithReportProviders(<DeliveryHistoryTable scheduleId="sched-1" />);

    expect((await screen.findAllByText('Sent')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SMTP connection timeout').length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    mockFetchScheduleDeliveries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 5, total: 0 },
    });

    const { container } = renderWithReportProviders(<DeliveryHistoryTable scheduleId="sched-1" />);

    const elements = await screen.findAllByText('No deliveries yet');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
