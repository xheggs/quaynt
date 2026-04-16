import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { within } from '@testing-library/react';
import { renderWithBrandProviders } from './test-utils';
import { DeleteBrandDialog } from '../delete-brand-dialog';
import type { Brand } from '../../brand.types';

const mockBrand: Brand = {
  id: 'brand-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  domain: 'acme.com',
  aliases: [],
  description: null,
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function getDialog(baseElement: HTMLElement) {
  return baseElement.querySelector('[role="dialog"]') as HTMLElement;
}

describe('DeleteBrandDialog', () => {
  it('renders without accessibility violations when open', async () => {
    const { baseElement } = renderWithBrandProviders(
      <DeleteBrandDialog brand={mockBrand} open={true} onOpenChange={() => {}} />
    );
    expect(
      await axe(baseElement, {
        rules: {
          'color-contrast': { enabled: false },
          'nested-interactive': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });

  it('renders brand name in confirmation description', () => {
    const { baseElement } = renderWithBrandProviders(
      <DeleteBrandDialog brand={mockBrand} open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    expect(dialog.textContent).toContain('Acme Corp');
  });

  it('renders cancel button in dialog', () => {
    const { baseElement } = renderWithBrandProviders(
      <DeleteBrandDialog brand={mockBrand} open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    const cancelButton = within(dialog).getByText('Cancel');
    expect(cancelButton).toBeDefined();
    expect(cancelButton.tagName).toBe('BUTTON');
  });
});
