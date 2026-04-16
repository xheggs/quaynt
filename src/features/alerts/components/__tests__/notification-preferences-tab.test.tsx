import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { NotificationPreferencesTab } from '../notification-preferences-tab';
import type { NotificationPreferencesResponse } from '../../alerts.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

vi.mock('../../alerts.api', () => ({
  fetchNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

import { fetchNotificationPreferences } from '../../alerts.api';

const mockPrefs: NotificationPreferencesResponse = {
  email: {
    id: 'pref_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    channel: 'email',
    enabled: true,
    digestFrequency: 'daily',
    digestHour: 9,
    digestDay: 1,
    digestTimezone: 'UTC',
    severityFilter: ['warning', 'critical'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  webhook: {
    id: 'pref_2',
    workspaceId: 'ws_1',
    userId: 'user_1',
    channel: 'webhook',
    enabled: false,
    digestFrequency: 'immediate',
    digestHour: 9,
    digestDay: 1,
    digestTimezone: 'UTC',
    severityFilter: ['info', 'warning', 'critical'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

describe('NotificationPreferencesTab', () => {
  it('renders email and webhook sections', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(mockPrefs);
    renderWithAlertProviders(<NotificationPreferencesTab />);
    expect(await screen.findByText('Email Notifications')).toBeDefined();
    expect(screen.getByText('Webhook Notifications')).toBeDefined();
  });

  it('shows save button', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(mockPrefs);
    renderWithAlertProviders(<NotificationPreferencesTab />);
    expect(await screen.findByText('Save preferences')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(mockPrefs);
    const { container } = renderWithAlertProviders(<NotificationPreferencesTab />);
    await screen.findByText('Email Notifications');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
