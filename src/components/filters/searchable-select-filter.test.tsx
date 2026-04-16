import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test-utils';
import { SearchableSelectFilter } from './searchable-select-filter';

const options = [
  { label: 'ChatGPT', value: 'chatgpt' },
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' },
];

describe('SearchableSelectFilter', () => {
  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(
      <SearchableSelectFilter options={options} onChange={() => {}} label="Platform" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows selected option label', () => {
    const { getByText } = renderWithProviders(
      <SearchableSelectFilter
        options={options}
        value="chatgpt"
        onChange={() => {}}
        label="Platform"
      />
    );
    expect(getByText('ChatGPT')).toBeDefined();
  });

  it('shows placeholder when no selection', () => {
    const { getByText } = renderWithProviders(
      <SearchableSelectFilter
        options={options}
        onChange={() => {}}
        label="Platform"
        placeholder="Select platform"
      />
    );
    expect(getByText('Select platform')).toBeDefined();
  });
});
