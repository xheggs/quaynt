import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { PromptList } from '../prompt-list';
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

const mockPrompts: Prompt[] = [
  {
    id: 'p-1',
    promptSetId: 'ps-1',
    template: 'What is {{brand}}?',
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

describe('PromptList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders prompts in order', () => {
    renderWithPromptSetProviders(
      <PromptList promptSetId="ps-1" prompts={mockPrompts} onDeletePrompt={() => {}} />
    );
    expect(screen.getByText(/What is/)).toBeDefined();
    expect(screen.getByText(/Compare/)).toBeDefined();
  });

  it('shows empty state when no prompts', () => {
    renderWithPromptSetProviders(
      <PromptList promptSetId="ps-1" prompts={[]} onDeletePrompt={() => {}} />
    );
    expect(screen.getByText('No prompts yet')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithPromptSetProviders(
      <PromptList promptSetId="ps-1" prompts={mockPrompts} onDeletePrompt={() => {}} />
    );
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          // @dnd-kit adds role="button" to sortable wrappers, which
          // creates nested-interactive with child buttons. This is an
          // accepted pattern in accessible drag-and-drop libraries.
          'nested-interactive': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });
});
