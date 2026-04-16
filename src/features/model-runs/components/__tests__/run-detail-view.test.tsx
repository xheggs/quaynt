import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithRunProviders } from './test-utils';
import { ModelRunDetailView } from '../run-detail-view';
import type { ModelRunDetail } from '../../model-run.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/model-runs/run-1',
}));

// Mock APIs
vi.mock('../../model-run.api', () => ({
  fetchModelRun: vi.fn(),
  cancelModelRun: vi.fn(),
  fetchModelRunResults: vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 25, total: 0 },
  }),
  fetchAdapterConfigs: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'ac-1',
        platformId: 'openai',
        displayName: 'ChatGPT',
        enabled: true,
        credentialsSet: true,
      },
    ],
    meta: { page: 1, limit: 50, total: 1 },
  }),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({
    data: [{ id: 'brand-1', name: 'Acme Corp' }],
    meta: { page: 1, limit: 100, total: 1 },
  }),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({
    data: [{ id: 'ps-1', name: 'Default Set' }],
    meta: { page: 1, limit: 100, total: 1 },
  }),
}));

import { fetchModelRun } from '../../model-run.api';

const mockRunDetail: ModelRunDetail = {
  id: 'run-1',
  workspaceId: 'ws-1',
  promptSetId: 'ps-1',
  brandId: 'brand-1',
  adapterConfigIds: ['ac-1'],
  locale: 'en-US',
  market: 'SaaS',
  status: 'completed',
  totalResults: 10,
  pendingResults: 0,
  errorSummary: null,
  startedAt: '2026-01-15T00:00:00Z',
  completedAt: '2026-01-15T00:05:00Z',
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:05:00Z',
  resultSummary: {
    total: 10,
    completed: 8,
    failed: 1,
    pending: 0,
    running: 0,
    skipped: 1,
  },
};

describe('ModelRunDetailView', () => {
  it('renders run detail with resolved names', async () => {
    vi.mocked(fetchModelRun).mockResolvedValue(mockRunDetail);
    renderWithRunProviders(<ModelRunDetailView runId="run-1" />);
    expect(await screen.findByText('Default Set')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('ChatGPT')).toBeDefined();
    expect(screen.getByText('en-US')).toBeDefined();
    expect(screen.getByText('SaaS')).toBeDefined();
  });

  it('renders progress indicator for completed run', async () => {
    vi.mocked(fetchModelRun).mockResolvedValue(mockRunDetail);
    const { container } = renderWithRunProviders(<ModelRunDetailView runId="run-1" />);
    await screen.findByText('Default Set');
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeDefined();
  });

  it('does not show cancel button for completed run', async () => {
    vi.mocked(fetchModelRun).mockResolvedValue(mockRunDetail);
    renderWithRunProviders(<ModelRunDetailView runId="run-1" />);
    await screen.findByText('Default Set');
    expect(screen.queryByText('Cancel Run')).toBeNull();
  });

  it('shows cancel button for running run', async () => {
    vi.mocked(fetchModelRun).mockResolvedValue({
      ...mockRunDetail,
      status: 'running',
      completedAt: null,
    });
    renderWithRunProviders(<ModelRunDetailView runId="run-1" />);
    expect(await screen.findByText('Cancel Run')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchModelRun).mockResolvedValue(mockRunDetail);
    const { container } = renderWithRunProviders(<ModelRunDetailView runId="run-1" />);
    await screen.findAllByText('Acme Corp');
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          'button-name': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });
});
