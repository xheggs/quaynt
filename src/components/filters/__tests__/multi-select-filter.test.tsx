// Polyfill ResizeObserver for Radix UI components in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { MultiSelectFilter } from '../multi-select-filter';

import uiMessages from '../../../../locales/en/ui.json';

const messages = { ...uiMessages };

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

const options = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b' },
  { label: 'Gamma', value: 'c' },
  { label: 'Delta', value: 'd' },
];

describe('MultiSelectFilter', () => {
  it('renders with label', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelectFilter options={options} value={[]} onChange={onChange} label="Select items" />
    );

    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('shows selected count when items are selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelectFilter
        options={options}
        value={['a', 'b']}
        onChange={onChange}
        label="Select items"
      />
    );

    expect(screen.getByText('2 selected')).toBeDefined();
  });

  it('renders removable badges for selected items', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelectFilter
        options={options}
        value={['a', 'b']}
        onChange={onChange}
        label="Select items"
      />
    );

    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
  });

  it('renders remove buttons for badges', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelectFilter
        options={options}
        value={['a', 'b']}
        onChange={onChange}
        label="Select items"
      />
    );

    const removeButtons = screen.getAllByLabelText(/^Remove /);
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders without accessibility violations', async () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <MultiSelectFilter options={options} value={['a']} onChange={onChange} label="Select items" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
