import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithBrandProviders } from './test-utils';
import { BrandDetailView } from '../brand-detail-view';
import { ApiError } from '@/lib/query/types';
import type { Brand } from '../../brand.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/brands/brand-1',
}));

// Mock the brand API module
vi.mock('../../brand.api', () => ({
  fetchBrand: vi.fn(),
  fetchBrands: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
}));

import { fetchBrand } from '../../brand.api';

const mockBrand: Brand = {
  id: 'brand-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  domain: 'acme.com',
  aliases: ['Acme', 'ACME Inc'],
  description: 'A great company',
  metadata: {},
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

describe('BrandDetailView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(fetchBrand).mockReset();
  });

  it('renders brand information', async () => {
    vi.mocked(fetchBrand).mockResolvedValue(mockBrand);
    const { container } = renderWithBrandProviders(<BrandDetailView brandId="brand-1" />);
    // Brand name appears in breadcrumb + h1, so use findAllByText
    const elements = await screen.findAllByText('Acme Corp');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('acme.com');
    expect(container.textContent).toContain('A great company');
  });

  it('shows breadcrumb with brand name', async () => {
    vi.mocked(fetchBrand).mockResolvedValue(mockBrand);
    const { container } = renderWithBrandProviders(<BrandDetailView brandId="brand-1" />);
    await screen.findAllByText('Acme Corp');
    // Breadcrumb uses aria-label from i18n
    const breadcrumb = container.querySelector('nav');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb!.textContent).toContain('Brands');
    expect(breadcrumb!.textContent).toContain('Acme Corp');
  });

  it('shows error state for non-existent brand', async () => {
    vi.mocked(fetchBrand).mockRejectedValue(new ApiError('NOT_FOUND', 'Brand not found', 404));
    renderWithBrandProviders(<BrandDetailView brandId="bad-id" />);
    expect(await screen.findByText('Brand not found')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchBrand).mockResolvedValue(mockBrand);
    const { container } = renderWithBrandProviders(<BrandDetailView brandId="brand-1" />);
    await screen.findAllByText('Acme Corp');
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          'heading-order': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });
});
