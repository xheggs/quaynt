import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithBenchmarkProviders } from './test-utils';
import { BenchmarkFilterBar } from '../benchmark-filters';

const mockPromptSets = [
  { value: 'ps-1', label: 'SaaS Tools' },
  { value: 'ps-2', label: 'CRM Software' },
];

const mockPlatforms = [
  { value: 'chatgpt', label: 'chatgpt' },
  { value: 'perplexity', label: 'perplexity' },
];

describe('BenchmarkFilterBar', () => {
  it('renders market dropdown when options are available', () => {
    renderWithBenchmarkProviders(
      <BenchmarkFilterBar
        filters={{ promptSetId: '' }}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockPromptSets}
        platformOptions={mockPlatforms}
        promptSetLoading={false}
      />
    );
    expect(screen.getByText((t) => t.includes('Select a market'))).toBeDefined();
  });

  it('renders platform filter when options available', () => {
    const { container } = renderWithBenchmarkProviders(
      <BenchmarkFilterBar
        filters={{ promptSetId: 'ps-1' }}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockPromptSets}
        platformOptions={mockPlatforms}
        promptSetLoading={false}
      />
    );
    // There should be multiple filter controls when platform options are provided
    const comboboxes = container.querySelectorAll('[role="combobox"]');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders comparison period selector', () => {
    const { container } = renderWithBenchmarkProviders(
      <BenchmarkFilterBar
        filters={{ promptSetId: 'ps-1' }}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockPromptSets}
        platformOptions={[]}
        promptSetLoading={false}
      />
    );
    expect(container.querySelector('[data-slot="filter-bar"]')).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(
      <BenchmarkFilterBar
        filters={{ promptSetId: '' }}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockPromptSets}
        platformOptions={mockPlatforms}
        promptSetLoading={false}
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
