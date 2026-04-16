import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { AddPromptForm } from '../add-prompt-form';
import type { Prompt } from '../../prompt-set.types';

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

import { addPrompt } from '../../prompt-set.api';

describe('AddPromptForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders textarea with placeholder', () => {
    renderWithPromptSetProviders(<AddPromptForm promptSetId="ps-1" />);
    expect(screen.getByLabelText('Prompt Template')).toBeDefined();
  });

  it('disables submit when empty', () => {
    renderWithPromptSetProviders(<AddPromptForm promptSetId="ps-1" />);
    const button = screen.getByText('Add Prompt');
    expect(button.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  it('calls add mutation on submit', async () => {
    const mockPrompt: Prompt = {
      id: 'p-new',
      promptSetId: 'ps-1',
      template: 'Test template',
      order: 0,
      createdAt: '2026-01-15T00:00:00Z',
    };
    vi.mocked(addPrompt).mockResolvedValue(mockPrompt);
    renderWithPromptSetProviders(<AddPromptForm promptSetId="ps-1" />);
    const textarea = screen.getByLabelText('Prompt Template');
    fireEvent.change(textarea, { target: { value: 'Test template' } });
    const button = screen.getByText('Add Prompt');
    fireEvent.click(button);
    await waitFor(() => {
      expect(addPrompt).toHaveBeenCalledWith('ps-1', {
        template: 'Test template',
      });
    });
  });

  it('shows variable preview when template has variables', () => {
    renderWithPromptSetProviders(<AddPromptForm promptSetId="ps-1" />);
    const textarea = screen.getByLabelText('Prompt Template');
    fireEvent.change(textarea, {
      target: { value: 'What is {{brand}}?' },
    });
    expect(screen.getByText('{{brand}}')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithPromptSetProviders(<AddPromptForm promptSetId="ps-1" />);
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
