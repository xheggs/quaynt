import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { PromptSetDetailView } from '../prompt-set-detail-view';
import type { PromptSetDetail, Prompt } from '../../prompt-set.types';
import { ApiError } from '@/lib/query/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/prompt-sets/ps-1',
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

import { fetchPromptSet, fetchPrompts } from '../../prompt-set.api';

const mockPromptSet: PromptSetDetail = {
  id: 'ps-1',
  name: 'Product Reviews',
  description: 'Reviews for electronics',
  tags: ['electronics', 'reviews'],
  promptCount: 2,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

const mockPrompts: Prompt[] = [
  {
    id: 'p-1',
    promptSetId: 'ps-1',
    template: 'What is {{brand}} in {{market}}?',
    order: 0,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'p-2',
    promptSetId: 'ps-1',
    template: 'Compare {{brand}} to competitors',
    order: 1,
    createdAt: '2026-01-16T00:00:00Z',
  },
];

describe('PromptSetDetailView', () => {
  it('renders prompt set information', async () => {
    vi.mocked(fetchPromptSet).mockResolvedValue(mockPromptSet);
    vi.mocked(fetchPrompts).mockResolvedValue(mockPrompts);
    renderWithPromptSetProviders(<PromptSetDetailView promptSetId="ps-1" />);
    // Name appears in breadcrumb and heading
    const elements = await screen.findAllByText('Product Reviews');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reviews for electronics')).toBeDefined();
  });

  it('shows breadcrumb with prompt set name', async () => {
    vi.mocked(fetchPromptSet).mockResolvedValue(mockPromptSet);
    vi.mocked(fetchPrompts).mockResolvedValue(mockPrompts);
    renderWithPromptSetProviders(<PromptSetDetailView promptSetId="ps-1" />);
    await screen.findAllByText('Product Reviews');
    expect(screen.getByText('Prompt Sets')).toBeDefined();
  });

  it('shows error state for non-existent prompt set', async () => {
    vi.mocked(fetchPromptSet).mockRejectedValue(new ApiError('NOT_FOUND', 'Not found', 404));
    renderWithPromptSetProviders(<PromptSetDetailView promptSetId="nonexistent" />);
    expect(await screen.findByText('Prompt set not found')).toBeDefined();
  });

  it('renders prompt list with prompt editors', async () => {
    vi.mocked(fetchPromptSet).mockResolvedValue(mockPromptSet);
    vi.mocked(fetchPrompts).mockResolvedValue(mockPrompts);
    renderWithPromptSetProviders(<PromptSetDetailView promptSetId="ps-1" />);
    const elements = await screen.findAllByText(/What is/);
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Compare/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchPromptSet).mockResolvedValue(mockPromptSet);
    vi.mocked(fetchPrompts).mockResolvedValue(mockPrompts);
    const { container } = renderWithPromptSetProviders(<PromptSetDetailView promptSetId="ps-1" />);
    await screen.findAllByText('Product Reviews');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
