import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithBrandProviders } from './test-utils';
import { BrandListView } from '../brand-list-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { Brand } from '../../brand.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/brands',
}));

// Mock the brand API module
vi.mock('../../brand.api', () => ({
  fetchBrand: vi.fn(),
  fetchBrands: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
}));

import { fetchBrands } from '../../brand.api';

const mockBrands: Brand[] = [
  {
    id: 'brand-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    domain: 'acme.com',
    aliases: ['Acme', 'ACME Inc'],
    description: 'A test brand',
    metadata: {},
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'brand-2',
    name: 'Beta Inc',
    slug: 'beta-inc',
    domain: null,
    aliases: [],
    description: null,
    metadata: {},
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const mockResponse: PaginatedResponse<Brand> = {
  data: mockBrands,
  meta: { page: 1, limit: 25, total: 2 },
};

const emptyResponse: PaginatedResponse<Brand> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('BrandListView', () => {
  it('renders table with brand data', async () => {
    vi.mocked(fetchBrands).mockResolvedValue(mockResponse);
    renderWithBrandProviders(<BrandListView />);
    expect(await screen.findByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('Beta Inc')).toBeDefined();
  });

  it('renders empty state when no brands exist', async () => {
    vi.mocked(fetchBrands).mockResolvedValue(emptyResponse);
    renderWithBrandProviders(<BrandListView />);
    expect(await screen.findByText('No brands yet')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchBrands).mockResolvedValue(mockResponse);
    const { container } = renderWithBrandProviders(<BrandListView />);
    await screen.findByText('Acme Corp');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
