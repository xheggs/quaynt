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
import { ExportButton } from '../export-button';

import uiMessages from '../../../locales/en/ui.json';
import exportMessages from '../../../locales/en/exports.json';

const messages = { ...uiMessages, ...exportMessages };

vi.mock('@/features/reports/reports.api', () => ({
  buildExportUrl: vi.fn(
    (params: Record<string, string>) =>
      `/api/v1/exports?type=${params.type}&format=${params.format}`
  ),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('ExportButton', () => {
  it('renders single format as direct button', () => {
    renderWithProviders(
      <ExportButton exportType="citations" filters={{ promptSetId: 'ps-1' }} formats={['csv']} />
    );

    expect(screen.getByText('Export')).toBeDefined();
  });

  it('renders multiple formats with dropdown indicator', () => {
    renderWithProviders(
      <ExportButton
        exportType="citations"
        filters={{ promptSetId: 'ps-1' }}
        formats={['csv', 'json']}
      />
    );

    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('shows count when totalCount provided', () => {
    renderWithProviders(
      <ExportButton
        exportType="citations"
        filters={{ promptSetId: 'ps-1' }}
        formats={['csv']}
        totalCount={42}
      />
    );

    expect(screen.getByText('Export (42)')).toBeDefined();
  });

  it('disabled state prevents interaction', () => {
    renderWithProviders(
      <ExportButton
        exportType="citations"
        filters={{ promptSetId: 'ps-1' }}
        formats={['csv']}
        disabled
      />
    );

    const buttons = screen.getAllByRole('button');
    const hasDisabled = buttons.some(
      (b) =>
        b.hasAttribute('disabled') ||
        b.getAttribute('data-disabled') !== null ||
        b.getAttribute('aria-disabled') === 'true'
    );
    expect(hasDisabled).toBe(true);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(
      <ExportButton exportType="citations" filters={{ promptSetId: 'ps-1' }} formats={['csv']} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
