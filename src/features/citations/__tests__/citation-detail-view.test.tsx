import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithCitationProviders } from './test-utils';
import { CitationDetailView } from '../components/citation-detail-view';
import { ApiError } from '@/lib/query/types';
import type { CitationRecord } from '../citation.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/citations/cit-1',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the citation API module
vi.mock('../citation.api', () => ({
  fetchCitations: vi.fn(),
  fetchCitation: vi.fn(),
  buildCitationExportUrl: vi.fn(),
}));

import { fetchCitation } from '../citation.api';

const mockCitation: CitationRecord = {
  id: 'cit-1',
  workspaceId: 'ws-1',
  brandId: 'brand-1',
  modelRunId: 'run-1',
  modelRunResultId: 'result-1',
  platformId: 'chatgpt',
  citationType: 'earned',
  position: 2,
  contextSnippet: 'This brand was highly recommended.',
  relevanceSignal: 'domain_match',
  sourceUrl: 'https://example.com/article',
  title: 'Example Article',
  locale: 'en',
  sentimentLabel: 'positive',
  sentimentScore: '0.7500',
  sentimentConfidence: '0.95',
  createdAt: '2026-03-15T10:30:00Z',
  updatedAt: '2026-03-15T10:30:00Z',
};

const mockCitationNoSentiment: CitationRecord = {
  ...mockCitation,
  id: 'cit-2',
  sentimentLabel: null,
  sentimentScore: null,
  sentimentConfidence: null,
  contextSnippet: null,
};

describe('CitationDetailView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(fetchCitation).mockReset();
  });

  it('renders citation metadata', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);

    const elements = await screen.findAllByText('Example Article');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('example.com');
    expect(container.textContent).toContain('ChatGPT');
    expect(container.textContent).toContain('#2');
  });

  it('renders breadcrumb with navigation', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);
    await screen.findAllByText('Example Article');
    const breadcrumb = container.querySelector('nav');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb!.textContent).toContain('Citations');
  });

  it('shows error state for non-existent citation', async () => {
    vi.mocked(fetchCitation).mockRejectedValue(
      new ApiError('NOT_FOUND', 'Citation not found', 404)
    );
    renderWithCitationProviders(<CitationDetailView citationId="bad-id" />);
    expect(await screen.findByText('Citation not found')).toBeDefined();
  });

  it('renders source URL with rel noopener noreferrer', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);
    await screen.findAllByText('Example Article');

    const link = container.querySelector('a[href="https://example.com/article"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('hides sentiment section when sentiment is null', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitationNoSentiment);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-2" />);
    await screen.findAllByText('Example Article');
    expect(container.textContent).not.toContain('Sentiment analysis');
  });

  it('renders context snippet with blockquote styling', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);
    await screen.findAllByText('Example Article');

    const blockquote = container.querySelector('blockquote');
    expect(blockquote).not.toBeNull();
    expect(blockquote!.textContent).toContain('This brand was highly recommended.');
  });

  it('renders sentiment score and confidence', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);
    await screen.findAllByText('Example Article');
    // Score should be formatted
    expect(container.textContent).toContain('0.75');
    // Confidence should be formatted as percentage
    expect(container.textContent).toContain('95%');
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchCitation).mockResolvedValue(mockCitation);
    const { container } = renderWithCitationProviders(<CitationDetailView citationId="cit-1" />);
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
