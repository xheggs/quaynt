import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { WebhooksView } from '../webhooks-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { WebhookEndpoint } from '../../../integrations.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/settings/webhooks',
}));

vi.mock('../../../integrations.api', () => ({
  fetchWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  rotateWebhookSecret: vi.fn(),
  fetchWebhookDeliveries: vi.fn(),
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

import { fetchWebhooks } from '../../../integrations.api';
import { fetchWorkspace } from '../../../settings.api';

const mockWebhook: WebhookEndpoint = {
  id: 'wh-1',
  url: 'https://example.com/webhook',
  events: ['citation.new', 'alert.triggered'],
  description: 'Test webhook',
  enabled: true,
  disabledAt: null,
  disabledReason: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

const mockResponse: PaginatedResponse<WebhookEndpoint> = {
  data: [mockWebhook],
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<WebhookEndpoint> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('WebhooksView', () => {
  it('renders table with webhook data', async () => {
    vi.mocked(fetchWebhooks).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<WebhooksView />);
    expect(await screen.findByText('https://example.com/webhook')).toBeDefined();
  });

  it('renders empty state when no webhooks', async () => {
    vi.mocked(fetchWebhooks).mockResolvedValue(emptyResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<WebhooksView />);
    expect(await screen.findByText('No webhooks')).toBeDefined();
  });

  it('shows max limit message when at 10 webhooks', async () => {
    const fullResponse: PaginatedResponse<WebhookEndpoint> = {
      data: Array.from({ length: 10 }, (_, i) => ({
        ...mockWebhook,
        id: `wh-${i}`,
        url: `https://example.com/webhook-${i}`,
      })),
      meta: { page: 1, limit: 25, total: 10 },
    };
    vi.mocked(fetchWebhooks).mockResolvedValue(fullResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<WebhooksView />);
    expect(await screen.findByText('Maximum of 10 webhook endpoints reached')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchWebhooks).mockResolvedValue(mockResponse);
    vi.mocked(fetchWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const { container } = renderWithProviders(<WebhooksView />);
    await screen.findByText('https://example.com/webhook');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
