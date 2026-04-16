import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { AlertRulesTab } from '../alert-rules-tab';
import type { PaginatedResponse } from '@/lib/query/types';
import type { AlertRule } from '../../alerts.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

vi.mock('../../alerts.api', () => ({
  fetchAlertRules: vi.fn(),
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

import { fetchAlertRules } from '../../alerts.api';

const mockRule: AlertRule = {
  id: 'alertRule_1',
  workspaceId: 'ws_1',
  name: 'Share drop alert',
  description: 'Alerts when share drops',
  metric: 'recommendation_share',
  promptSetId: 'ps_1',
  scope: { brandId: 'brand_1' },
  condition: 'drops_below',
  threshold: '20.0000',
  direction: 'any',
  cooldownMinutes: 60,
  severity: 'warning',
  enabled: true,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockResponse: PaginatedResponse<AlertRule> = {
  data: [mockRule],
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<AlertRule> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('AlertRulesTab', () => {
  it('renders table with rule data', async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue(mockResponse);
    renderWithAlertProviders(<AlertRulesTab />);
    expect(await screen.findByText('Share drop alert')).toBeDefined();
  });

  it('renders empty state when no rules', async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue(emptyResponse);
    renderWithAlertProviders(<AlertRulesTab />);
    expect(await screen.findByText('No alert rules')).toBeDefined();
  });

  it('shows create button', async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue(mockResponse);
    renderWithAlertProviders(<AlertRulesTab />);
    await screen.findByText('Share drop alert');
    const createButtons = screen.getAllByText('Create Rule');
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue(mockResponse);
    const { container } = renderWithAlertProviders(<AlertRulesTab />);
    await screen.findByText('Share drop alert');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
