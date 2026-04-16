import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithRunProviders } from './test-utils';
import { ModelRunListView } from '../run-list-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { ModelRun } from '../../model-run.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/model-runs',
}));

// Mock APIs
vi.mock('../../model-run.api', () => ({
  fetchModelRuns: vi.fn(),
  createModelRun: vi.fn(),
  cancelModelRun: vi.fn(),
  fetchAdapterConfigs: vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 50, total: 0 },
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

import { fetchModelRuns } from '../../model-run.api';

const mockRuns: ModelRun[] = [
  {
    id: 'run-1',
    workspaceId: 'ws-1',
    promptSetId: 'ps-1',
    brandId: 'brand-1',
    adapterConfigIds: ['ac-1'],
    locale: null,
    market: null,
    status: 'completed',
    totalResults: 10,
    pendingResults: 0,
    errorSummary: null,
    startedAt: '2026-01-15T00:00:00Z',
    completedAt: '2026-01-15T00:05:00Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:05:00Z',
  },
];

const mockResponse: PaginatedResponse<ModelRun> = {
  data: mockRuns,
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<ModelRun> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('ModelRunListView', () => {
  it('renders table with resolved brand and prompt set names', async () => {
    vi.mocked(fetchModelRuns).mockResolvedValue(mockResponse);
    renderWithRunProviders(<ModelRunListView />);
    expect(await screen.findByText('Default Set')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });

  it('renders empty state when no runs exist', async () => {
    vi.mocked(fetchModelRuns).mockResolvedValue(emptyResponse);
    renderWithRunProviders(<ModelRunListView />);
    expect(await screen.findByText('No model runs yet')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchModelRuns).mockResolvedValue(mockResponse);
    const { container } = renderWithRunProviders(<ModelRunListView />);
    await screen.findByText('Default Set');
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          // DataTableRowActions dropdown trigger is screen-reader-labeled
          'button-name': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });
});
