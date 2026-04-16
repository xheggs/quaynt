import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { AlertsView } from '../alerts-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

// Mock all API calls used by sub-tabs
vi.mock('../../alerts.api', () => ({
  fetchAlertRules: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0 } }),
  fetchAlertEvents: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0 } }),
  fetchNotificationPreferences: vi.fn().mockResolvedValue({ email: null, webhook: null }),
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  acknowledgeEvent: vi.fn(),
  snoozeEvent: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

describe('AlertsView', () => {
  it('renders page title', async () => {
    renderWithAlertProviders(<AlertsView />);
    // Page has an h1 with "Alerts"
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings[0].textContent).toBe('Alerts');
  });

  it('renders tab buttons', () => {
    renderWithAlertProviders(<AlertsView />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    expect(tabs.map((t) => t.textContent)).toContain('Rules');
    expect(tabs.map((t) => t.textContent)).toContain('Events');
    expect(tabs.map((t) => t.textContent)).toContain('Notifications');
  });

  it('defaults to rules tab selected', () => {
    renderWithAlertProviders(<AlertsView />);
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent === 'Rules');
    expect(rulesTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('switches tabs on click', () => {
    renderWithAlertProviders(<AlertsView />);
    const tabs = screen.getAllByRole('tab');
    const eventsTab = tabs.find((t) => t.textContent === 'Events')!;
    fireEvent.click(eventsTab);
    expect(eventsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithAlertProviders(<AlertsView />);
    await screen.findAllByRole('heading', { level: 1 });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
