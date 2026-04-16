import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { PromptSetListView } from '../prompt-set-list-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { PromptSet } from '../../prompt-set.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/prompt-sets',
}));

vi.mock('../../prompt-set.api', () => ({
  fetchPromptSets: vi.fn(),
  fetchPromptSet: vi.fn(),
  createPromptSet: vi.fn(),
  updatePromptSet: vi.fn(),
  deletePromptSet: vi.fn(),
  fetchPrompts: vi.fn(),
  addPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  reorderPrompts: vi.fn(),
}));

import { fetchPromptSets } from '../../prompt-set.api';

const mockPromptSets: PromptSet[] = [
  {
    id: 'ps-1',
    name: 'Product Reviews',
    description: 'Reviews for electronics',
    tags: ['electronics', 'reviews'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'ps-2',
    name: 'Competitor Analysis',
    description: null,
    tags: [],
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const mockResponse: PaginatedResponse<PromptSet> = {
  data: mockPromptSets,
  meta: { page: 1, limit: 25, total: 2 },
};

const emptyResponse: PaginatedResponse<PromptSet> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('PromptSetListView', () => {
  it('renders table with prompt set data', async () => {
    vi.mocked(fetchPromptSets).mockResolvedValue(mockResponse);
    renderWithPromptSetProviders(<PromptSetListView />);
    expect(await screen.findByText('Product Reviews')).toBeDefined();
    expect(screen.getByText('Competitor Analysis')).toBeDefined();
  });

  it('renders empty state when no prompt sets exist', async () => {
    vi.mocked(fetchPromptSets).mockResolvedValue(emptyResponse);
    renderWithPromptSetProviders(<PromptSetListView />);
    expect(await screen.findByText('No prompt sets yet')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchPromptSets).mockResolvedValue(mockResponse);
    const { container } = renderWithPromptSetProviders(<PromptSetListView />);
    await screen.findByText('Product Reviews');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
