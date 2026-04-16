import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithCitationProviders } from './test-utils';
import { CitationListView } from '../components/citation-list-view';
import type { PaginatedResponse } from '@/lib/query/types';
import type { CitationRecord } from '../citation.types';
import type { Brand } from '@/features/brands/brand.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/citations',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the citation API module
vi.mock('../citation.api', () => ({
  fetchCitations: vi.fn(),
  fetchCitation: vi.fn(),
  buildCitationExportUrl: vi.fn(() => '/api/v1/exports?type=citations&format=csv'),
}));

// Mock the brand API module (used by filters)
vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn(),
}));

// Mock the reports API module (used by shared ExportButton)
vi.mock('@/features/reports/reports.api', () => ({
  buildExportUrl: vi.fn(() => '/api/v1/exports?type=citations&format=csv'),
}));

import { fetchCitations } from '../citation.api';
import { fetchBrands } from '@/features/brands/brand.api';

const mockCitations: CitationRecord[] = [
  {
    id: 'cit-1',
    workspaceId: 'ws-1',
    brandId: 'brand-1',
    modelRunId: 'run-1',
    modelRunResultId: 'result-1',
    platformId: 'chatgpt',
    citationType: 'earned',
    position: 1,
    contextSnippet: 'Great recommendation for this product.',
    relevanceSignal: 'domain_match',
    sourceUrl: 'https://example.com/article',
    title: 'Example Article',
    locale: 'en',
    sentimentLabel: 'positive',
    sentimentScore: '0.8000',
    sentimentConfidence: '0.92',
    createdAt: '2026-03-15T10:30:00Z',
    updatedAt: '2026-03-15T10:30:00Z',
  },
];

const mockResponse: PaginatedResponse<CitationRecord> = {
  data: mockCitations,
  meta: { page: 1, limit: 25, total: 1 },
};

const emptyResponse: PaginatedResponse<CitationRecord> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

const mockBrandsResponse: PaginatedResponse<Brand> = {
  data: [],
  meta: { page: 1, limit: 100, total: 0 },
};

describe('CitationListView', () => {
  it('renders table with citation data', async () => {
    vi.mocked(fetchCitations).mockResolvedValue(mockResponse);
    vi.mocked(fetchBrands).mockResolvedValue(mockBrandsResponse);
    renderWithCitationProviders(<CitationListView />);
    expect(await screen.findByText('Example Article')).toBeDefined();
  });

  it('renders empty state when no citations exist', async () => {
    vi.mocked(fetchCitations).mockResolvedValue(emptyResponse);
    vi.mocked(fetchBrands).mockResolvedValue(mockBrandsResponse);
    renderWithCitationProviders(<CitationListView />);
    expect(await screen.findByText('No citations yet')).toBeDefined();
  });

  it('renders export button with total count', async () => {
    vi.mocked(fetchCitations).mockResolvedValue(mockResponse);
    vi.mocked(fetchBrands).mockResolvedValue(mockBrandsResponse);
    renderWithCitationProviders(<CitationListView />);
    expect(await screen.findByText(/Export \(1\)/)).toBeDefined();
  });

  it('renders filter controls', async () => {
    vi.mocked(fetchCitations).mockResolvedValue(mockResponse);
    vi.mocked(fetchBrands).mockResolvedValue(mockBrandsResponse);
    const { container } = renderWithCitationProviders(<CitationListView />);
    await screen.findAllByText('Example Article');
    // Search filter should be present (data-slot="filter-bar")
    const filterBar = container.querySelector('[data-slot="filter-bar"]');
    expect(filterBar).not.toBeNull();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchCitations).mockResolvedValue(mockResponse);
    vi.mocked(fetchBrands).mockResolvedValue(mockBrandsResponse);
    const { container } = renderWithCitationProviders(<CitationListView />);
    await screen.findAllByText('Example Article');
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
