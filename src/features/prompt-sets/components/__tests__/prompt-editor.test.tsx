import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { PromptEditor } from '../prompt-editor';
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

import { updatePrompt } from '../../prompt-set.api';

const mockPrompt: Prompt = {
  id: 'p-1',
  promptSetId: 'ps-1',
  template: 'What is {{brand}} in {{market}}?',
  order: 0,
  createdAt: '2026-01-15T00:00:00Z',
};

describe('PromptEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders template with variable highlighting in view mode', () => {
    renderWithPromptSetProviders(
      <PromptEditor prompt={mockPrompt} promptSetId="ps-1" onDelete={() => {}} />
    );
    expect(screen.getByText(/What is/)).toBeDefined();
    expect(screen.getByText('{{brand}}')).toBeDefined();
    expect(screen.getByText('{{market}}')).toBeDefined();
  });

  it('enters edit mode on click', () => {
    renderWithPromptSetProviders(
      <PromptEditor prompt={mockPrompt} promptSetId="ps-1" onDelete={() => {}} />
    );
    fireEvent.click(screen.getByLabelText('Prompt Template'));
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('saves on button click', async () => {
    vi.mocked(updatePrompt).mockResolvedValue({
      ...mockPrompt,
      template: 'Updated template',
    });
    renderWithPromptSetProviders(
      <PromptEditor prompt={mockPrompt} promptSetId="ps-1" onDelete={() => {}} />
    );
    fireEvent.click(screen.getByLabelText('Prompt Template'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated template' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(updatePrompt).toHaveBeenCalledWith('ps-1', 'p-1', {
        template: 'Updated template',
      });
    });
  });

  it('cancels on Escape', () => {
    renderWithPromptSetProviders(
      <PromptEditor prompt={mockPrompt} promptSetId="ps-1" onDelete={() => {}} />
    );
    fireEvent.click(screen.getByLabelText('Prompt Template'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    // Should be back in view mode
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithPromptSetProviders(
      <PromptEditor prompt={mockPrompt} promptSetId="ps-1" onDelete={() => {}} />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
