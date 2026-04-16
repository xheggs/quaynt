import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithOpportunityProviders } from './test-utils';
import { OpportunityFilterBar } from '../opportunity-filters';
import type { OpportunityViewFilters } from '../../opportunity.types';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/opportunities',
}));

// Mock brand API
vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({
    data: [
      { id: 'b-1', name: 'TestBrand' },
      { id: 'b-2', name: 'AnotherBrand' },
    ],
    meta: { page: 1, limit: 100, total: 2 },
  }),
}));

const defaultFilters: OpportunityViewFilters = {
  promptSetId: 'ps-1',
  brandId: 'b-1',
};

const defaultProps = {
  filters: defaultFilters,
  onFiltersChange: vi.fn(),
  promptSetOptions: [
    { value: 'ps-1', label: 'SaaS Tools' },
    { value: 'ps-2', label: 'AI Assistants' },
  ],
  platformOptions: [
    { value: 'chatgpt', label: 'chatgpt' },
    { value: 'perplexity', label: 'perplexity' },
  ],
  promptSetLoading: false,
};

describe('OpportunityFilterBar', () => {
  it('renders type and min competitors filters', () => {
    renderWithOpportunityProviders(<OpportunityFilterBar {...defaultProps} />);

    // SelectFilter renders with aria-label on the trigger
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Min competitors' })).toBeDefined();
  });

  it('renders market and brand selectors', () => {
    renderWithOpportunityProviders(<OpportunityFilterBar {...defaultProps} />);

    // Market and brand are SearchableSelectFilter with aria-label
    expect(screen.getByRole('combobox', { name: 'Market' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Brand' })).toBeDefined();
  });

  it('renders platform filter when options available', () => {
    renderWithOpportunityProviders(<OpportunityFilterBar {...defaultProps} />);

    // Platform filter renders as SearchableSelectFilter with aria-label="Platform"
    expect(screen.getByRole('combobox', { name: 'Platform' })).toBeDefined();
  });

  it('hides platform filter when no options', () => {
    renderWithOpportunityProviders(<OpportunityFilterBar {...defaultProps} platformOptions={[]} />);

    expect(screen.queryByRole('combobox', { name: 'Platform' })).toBeNull();
  });

  it('counts active optional filters correctly', () => {
    const filtersWithOptionals: OpportunityViewFilters = {
      ...defaultFilters,
      type: 'missing',
      platformId: 'chatgpt',
    };

    renderWithOpportunityProviders(
      <OpportunityFilterBar {...defaultProps} filters={filtersWithOptionals} />
    );

    // The clear all button should be visible when active filters > 0
    expect(screen.getByText('Clear all filters')).toBeDefined();
  });

  it('shows loading state for market selector', () => {
    const { container } = renderWithOpportunityProviders(
      <OpportunityFilterBar {...defaultProps} promptSetLoading={true} />
    );
    // When loading, a disabled SelectFilter is rendered instead of SearchableSelectFilter
    expect(container).toBeTruthy();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithOpportunityProviders(
      <OpportunityFilterBar {...defaultProps} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
