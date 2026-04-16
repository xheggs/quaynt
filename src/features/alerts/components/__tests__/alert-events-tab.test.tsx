import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { AlertEventsTab } from '../alert-events-tab';
import type { PaginatedResponse } from '@/lib/query/types';
import type { AlertEvent } from '../../alerts.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

vi.mock('../../alerts.api', () => ({
  fetchAlertEvents: vi.fn(),
  fetchAlertRules: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
  acknowledgeEvent: vi.fn(),
  snoozeEvent: vi.fn(),
}));

import { fetchAlertEvents } from '../../alerts.api';

const mockEvent: AlertEvent = {
  id: 'alertevt_1',
  alertRuleId: 'alertRule_1',
  ruleName: 'Share drop alert',
  workspaceId: 'ws_1',
  severity: 'warning',
  metricValue: '15.5000',
  previousValue: '22.0000',
  threshold: '20.0000',
  condition: 'drops_below',
  scopeSnapshot: { brandId: 'brand_1', brandName: 'Acme Corp' },
  triggeredAt: '2026-03-15T10:30:00Z',
  acknowledgedAt: null,
  snoozedUntil: null,
  createdAt: '2026-03-15T10:30:00Z',
  updatedAt: '2026-03-15T10:30:00Z',
};

const mockResponse: PaginatedResponse<AlertEvent> = {
  data: [mockEvent],
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<AlertEvent> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('AlertEventsTab', () => {
  it('renders events table', async () => {
    vi.mocked(fetchAlertEvents).mockResolvedValue(mockResponse);
    renderWithAlertProviders(<AlertEventsTab />);
    expect(await screen.findByText('Share drop alert')).toBeDefined();
  });

  it('renders empty state when no events', async () => {
    vi.mocked(fetchAlertEvents).mockResolvedValue(emptyResponse);
    renderWithAlertProviders(<AlertEventsTab />);
    expect(await screen.findByText('No alert events')).toBeDefined();
  });

  it('shows brand name from scope snapshot', async () => {
    vi.mocked(fetchAlertEvents).mockResolvedValue(mockResponse);
    renderWithAlertProviders(<AlertEventsTab />);
    expect(await screen.findByText('Acme Corp')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchAlertEvents).mockResolvedValue(mockResponse);
    const { container } = renderWithAlertProviders(<AlertEventsTab />);
    await screen.findByText('Share drop alert');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
