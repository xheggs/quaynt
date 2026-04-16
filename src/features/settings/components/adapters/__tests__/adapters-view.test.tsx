import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { AdaptersView } from '../adapters-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { AdapterConfig } from '../../../integrations.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/settings/adapters',
}));

vi.mock('../../../integrations.api', () => ({
  fetchAdapters: vi.fn(),
  fetchPlatforms: vi.fn(),
  updateAdapter: vi.fn(),
  createAdapter: vi.fn(),
  deleteAdapter: vi.fn(),
  checkAdapterHealth: vi.fn(),
}));

vi.mock('../../../settings.api', () => ({
  fetchWorkspace: vi.fn(),
}));

vi.mock('@/modules/auth/auth.client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'user-1' } },
    }),
  },
}));

import { fetchAdapters } from '../../../integrations.api';
import { fetchWorkspace } from '../../../settings.api';

const mockAdapter: AdapterConfig = {
  id: 'adapter-1',
  workspaceId: 'ws-1',
  platformId: 'chatgpt',
  displayName: 'My ChatGPT',
  enabled: true,
  credentialsSet: true,
  config: {},
  rateLimitPoints: 100,
  rateLimitDuration: 60000,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
  lastHealthStatus: 'healthy',
  lastHealthCheckedAt: '2026-04-10T12:00:00Z',
  deletedAt: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-10T12:00:00Z',
};

const mockResponse: PaginatedResponse<AdapterConfig> = {
  data: [mockAdapter],
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<AdapterConfig> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('AdaptersView', () => {
  it('renders table with adapter data', async () => {
    vi.mocked(fetchAdapters).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<AdaptersView />);
    expect(await screen.findByText('My ChatGPT')).toBeDefined();
  });

  it('renders empty state when no adapters', async () => {
    vi.mocked(fetchAdapters).mockResolvedValue(emptyResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<AdaptersView />);
    expect(await screen.findByText('No adapters configured')).toBeDefined();
  });

  it('shows add button for admin users', async () => {
    vi.mocked(fetchAdapters).mockResolvedValue(emptyResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<AdaptersView />);
    await screen.findByText('No adapters configured');
    expect(screen.getAllByText('Add Adapter').length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchAdapters).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const { container } = renderWithProviders(<AdaptersView />);
    await screen.findByText('My ChatGPT');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
