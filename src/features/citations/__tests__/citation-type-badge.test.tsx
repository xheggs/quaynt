import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithCitationProviders } from './test-utils';
import { CitationTypeBadge } from '../components/citation-type-badge';

describe('CitationTypeBadge', () => {
  it('renders owned badge', () => {
    renderWithCitationProviders(<CitationTypeBadge type="owned" />);
    expect(screen.getByText('Owned')).toBeDefined();
  });

  it('renders earned badge', () => {
    renderWithCitationProviders(<CitationTypeBadge type="earned" />);
    expect(screen.getByText('Earned')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithCitationProviders(<CitationTypeBadge type="owned" />);
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
