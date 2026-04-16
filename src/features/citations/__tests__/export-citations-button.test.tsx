import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithCitationProviders } from './test-utils';
import { ExportCitationsButton } from '../components/export-citations-button';

vi.mock('@/features/reports/reports.api', () => ({
  buildExportUrl: vi.fn(
    (params: Record<string, string>) =>
      `/api/v1/exports?type=${params.type}&format=${params.format}`
  ),
}));

describe('ExportCitationsButton', () => {
  it('renders with count label when totalCount > 0', () => {
    renderWithCitationProviders(<ExportCitationsButton filters={{}} totalCount={42} />);
    expect(screen.getByText('Export (42)')).toBeDefined();
  });

  it('renders fallback label when totalCount is 0', () => {
    renderWithCitationProviders(<ExportCitationsButton filters={{}} totalCount={0} />);
    expect(screen.getByText('Export')).toBeDefined();
  });

  it('is disabled when disabled prop is true', () => {
    const { container } = renderWithCitationProviders(
      <ExportCitationsButton filters={{}} totalCount={10} disabled />
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.hasAttribute('disabled')).toBe(true);
  });

  it('constructs correct export URL with filters', () => {
    renderWithCitationProviders(
      <ExportCitationsButton
        filters={{ brandId: 'brand-1', sentiment: 'positive' }}
        totalCount={5}
      />
    );

    expect(screen.getByText('Export (5)')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithCitationProviders(
      <ExportCitationsButton filters={{}} totalCount={10} />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
