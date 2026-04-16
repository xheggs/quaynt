import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { ApiKeysView } from '../api-keys-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { ApiKeyInfo } from '../../../integrations.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/settings/api-keys',
}));

vi.mock('../../../integrations.api', () => ({
  fetchApiKeys: vi.fn(),
  generateApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
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

import { fetchApiKeys } from '../../../integrations.api';
import { fetchWorkspace } from '../../../settings.api';

const mockKey: ApiKeyInfo = {
  id: 'key-1',
  name: 'My Integration Key',
  keyPrefix: 'qk_a1b2c3d',
  scopes: 'read',
  lastUsedAt: null,
  expiresAt: null,
  createdAt: '2026-04-01T00:00:00Z',
};

const mockResponse: PaginatedResponse<ApiKeyInfo> = {
  data: [mockKey],
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<ApiKeyInfo> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('ApiKeysView', () => {
  it('renders table with API key data', async () => {
    vi.mocked(fetchApiKeys).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<ApiKeysView />);
    expect(await screen.findByText('My Integration Key')).toBeDefined();
  });

  it('renders empty state when no keys', async () => {
    vi.mocked(fetchApiKeys).mockResolvedValue(emptyResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<ApiKeysView />);
    expect(await screen.findByText('No API keys')).toBeDefined();
  });

  it('shows generate button for admin users', async () => {
    vi.mocked(fetchApiKeys).mockResolvedValue(emptyResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<ApiKeysView />);
    await screen.findByText('No API keys');
    expect(screen.getAllByText('Generate New Key').length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchApiKeys).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const { container } = renderWithProviders(<ApiKeysView />);
    await screen.findByText('My Integration Key');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
