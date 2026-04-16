import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { PromptSetFormDialog } from '../prompt-set-form-dialog';
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

import { createPromptSet, updatePromptSet } from '../../prompt-set.api';

const mockPromptSet: PromptSet = {
  id: 'ps-1',
  name: 'Product Reviews',
  description: 'Reviews for electronics',
  tags: ['electronics', 'reviews'],
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

describe('PromptSetFormDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders create dialog with empty fields and correct title', () => {
    renderWithPromptSetProviders(
      <PromptSetFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    expect(screen.getByText('Create Prompt Set')).toBeDefined();
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('renders edit dialog pre-filled with prompt set data', () => {
    renderWithPromptSetProviders(
      <PromptSetFormDialog
        mode="edit"
        promptSet={mockPromptSet}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText('Edit Prompt Set')).toBeDefined();
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Product Reviews');
  });

  it('validates required name field on submit', async () => {
    renderWithPromptSetProviders(
      <PromptSetFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    const submitButton = screen.getByText('Add Prompt Set');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText('Prompt set name is required')).toBeDefined();
    });
    expect(createPromptSet).not.toHaveBeenCalled();
  });

  it('calls create mutation with form data on submit', async () => {
    vi.mocked(createPromptSet).mockResolvedValue(mockPromptSet);
    renderWithPromptSetProviders(
      <PromptSetFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Set' },
    });
    const submitButton = screen.getByText('Add Prompt Set');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(createPromptSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Set' }));
    });
  });

  it('renders without accessibility violations (create mode)', async () => {
    const { container } = renderWithPromptSetProviders(
      <PromptSetFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });

  it('renders without accessibility violations (edit mode)', async () => {
    const { container } = renderWithPromptSetProviders(
      <PromptSetFormDialog
        mode="edit"
        promptSet={mockPromptSet}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
