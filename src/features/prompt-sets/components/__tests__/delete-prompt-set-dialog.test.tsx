import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { DeletePromptSetDialog } from '../delete-prompt-set-dialog';
import type { PromptSet } from '../../prompt-set.types';

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

import { deletePromptSet } from '../../prompt-set.api';

const mockPromptSet: PromptSet = {
  id: 'ps-1',
  name: 'Product Reviews',
  description: null,
  tags: [],
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

describe('DeletePromptSetDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders prompt set name in confirmation description', () => {
    renderWithPromptSetProviders(
      <DeletePromptSetDialog promptSet={mockPromptSet} open={true} onOpenChange={() => {}} />
    );
    expect(screen.getByText(/Product Reviews/)).toBeDefined();
  });

  it('calls delete mutation on confirm', async () => {
    vi.mocked(deletePromptSet).mockResolvedValue(undefined);
    renderWithPromptSetProviders(
      <DeletePromptSetDialog promptSet={mockPromptSet} open={true} onOpenChange={() => {}} />
    );
    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(deletePromptSet).toHaveBeenCalledWith('ps-1');
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithPromptSetProviders(
      <DeletePromptSetDialog promptSet={mockPromptSet} open={true} onOpenChange={() => {}} />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
