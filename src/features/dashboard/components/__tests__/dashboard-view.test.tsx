import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { DashboardView } from '../dashboard-view';
import type { DashboardResponse } from '../../dashboard.types';
import type { PaginatedResponse } from '@/lib/query/types';

afterEach(() => {
  cleanup();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/dashboard',
}));

// Mock the dashboard API
vi.mock('../../dashboard.api', () => ({
  fetchDashboard: vi.fn(),
  fetchPromptSets: vi.fn(),
}));

import { fetchDashboard, fetchPromptSets } from '../../dashboard.api';

const mockDashboardData: DashboardResponse = {
  kpis: {
    recommendationShare: {
      current: '42.3%',
      previous: '38.1%',
      delta: '+4.2%',
      changeRate: '+11.0%',
      direction: 'up',
      sparkline: [
        { date: '2026-04-01', value: '38' },
        { date: '2026-04-10', value: '42' },
      ],
    },
    totalCitations: {
      current: '1,234',
      previous: '1,100',
      delta: '+134',
      changeRate: '+12.2%',
      direction: 'up',
      sparkline: [
        { date: '2026-04-01', value: '1100' },
        { date: '2026-04-10', value: '1234' },
      ],
    },
    averageSentiment: {
      current: '0.72',
      previous: '0.75',
      delta: '-0.03',
      changeRate: '-4.0%',
      direction: 'down',
      sparkline: [
        { date: '2026-04-01', value: '0.75' },
        { date: '2026-04-10', value: '0.72' },
      ],
    },
  },
  movers: [
    {
      brandId: '1',
      brandName: 'Acme',
      metric: 'recommendation_share',
      current: '42.3%',
      previous: '38.1%',
      delta: '+4.2%',
      direction: 'up',
    },
  ],
  opportunities: [
    {
      brandId: '1',
      brandName: 'Acme',
      query: 'best tools 2026',
      type: 'missing',
      competitorCount: 3,
    },
  ],
  platforms: [
    {
      adapterId: 'a1',
      platformId: 'chatgpt',
      displayName: 'ChatGPT',
      enabled: true,
      lastHealthStatus: 'healthy',
      lastHealthCheckedAt: '2026-04-10T10:00:00Z',
    },
  ],
  alerts: {
    active: 1,
    total: 1,
    bySeverity: { info: 0, warning: 1, critical: 0 },
    recentEvents: [
      {
        id: 'e1',
        ruleId: 'r1',
        severity: 'warning',
        triggeredAt: '2026-04-10T10:00:00Z',
        message: 'Citation count declining',
      },
    ],
  },
  dataAsOf: '2026-04-10T12:00:00Z',
  promptSet: { id: 'ps-1', name: 'Default' },
  period: { from: '2026-03-12', to: '2026-04-10' },
};

const emptyPromptSets: PaginatedResponse<{ id: string; name: string }> = {
  data: [],
  meta: { page: 1, limit: 100, total: 0 },
};

describe('DashboardView', () => {
  it('renders all sections with dashboard data', async () => {
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboardData);
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    renderWithDashboardProviders(<DashboardView />);

    // Wait for data to load — use findAllByText since 42.3% appears in both KPI card and movers
    const values = await screen.findAllByText('42.3%');
    expect(values.length).toBeGreaterThan(0);
    expect(screen.getByText('1,234')).toBeDefined();
    expect(screen.getByText('0.72')).toBeDefined();

    // Section headings
    expect(screen.getByText('Top Movers')).toBeDefined();
    expect(screen.getByText('Top Opportunities')).toBeDefined();
    expect(screen.getByText('Platform Health')).toBeDefined();
    expect(screen.getByText('Recent Alerts')).toBeDefined();

    // Data freshness — hero now uses "Updated {date}" instead of "Last updated".
    expect(screen.getByText((t) => t.includes('Updated'))).toBeDefined();
  });

  it('shows loading skeleton during fetch', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchDashboard).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    const { container } = renderWithDashboardProviders(<DashboardView />);
    // Advance past the 150ms delay threshold for useDelayedLoading
    await vi.advanceTimersByTimeAsync(200);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('shows error state on API failure', async () => {
    vi.mocked(fetchDashboard).mockRejectedValue(new Error('API Error'));
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    renderWithDashboardProviders(<DashboardView />);

    expect(await screen.findByText((t) => t.includes('Something went wrong'))).toBeDefined();
  });

  it('shows empty workspace state for fresh workspace', async () => {
    const emptyData: DashboardResponse = {
      ...mockDashboardData,
      kpis: null,
      movers: [],
      opportunities: [],
      platforms: [],
      alerts: {
        active: 0,
        total: 0,
        bySeverity: { info: 0, warning: 0, critical: 0 },
        recentEvents: [],
      },
      period: { from: '2026-04-10', to: '2026-04-10' },
      warnings: undefined,
    };
    vi.mocked(fetchDashboard).mockResolvedValue(emptyData);
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    renderWithDashboardProviders(<DashboardView />);

    expect(await screen.findByText('Welcome to Quaynt')).toBeDefined();
  });

  it('shows partial failure warnings when sections are null', async () => {
    const partialData: DashboardResponse = {
      ...mockDashboardData,
      movers: null,
      warnings: ['Movers section failed to load'],
    };
    vi.mocked(fetchDashboard).mockResolvedValue(partialData);
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    renderWithDashboardProviders(<DashboardView />);

    // Wait for data to load
    await screen.findByText('1,234');
    // Movers section shows inline error for null data (uses ErrorState's default title)
    expect(screen.getByText((t) => t === 'Something went wrong')).toBeDefined();
    // API warning text should be rendered somewhere in the page
    expect(document.body.textContent).toContain('Movers section failed to load');
  });

  it('passes accessibility checks', async () => {
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboardData);
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyPromptSets);

    const { container } = renderWithDashboardProviders(<DashboardView />);
    await screen.findAllByText('42.3%');

    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
