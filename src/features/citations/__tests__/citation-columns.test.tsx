import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { renderWithCitationProviders } from './test-utils';
import { useCitationColumns } from '../components/citation-columns';
import type { CitationRecord } from '../citation.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/citations',
}));

const mockCitation: CitationRecord = {
  id: 'cit-1',
  workspaceId: 'ws-1',
  brandId: 'brand-1',
  modelRunId: 'run-1',
  modelRunResultId: 'result-1',
  platformId: 'chatgpt',
  citationType: 'earned',
  position: 3,
  contextSnippet: 'This is a test snippet about the brand.',
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

const mockCitationNoTitle: CitationRecord = {
  ...mockCitation,
  id: 'cit-2',
  title: null,
  sentimentLabel: null,
  sentimentScore: null,
  sentimentConfidence: null,
};

function ColumnsTestWrapper({
  data,
  onViewDetail,
}: {
  data: CitationRecord[];
  onViewDetail: (c: CitationRecord) => void;
}) {
  const columns = useCitationColumns({ onViewDetail });
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('useCitationColumns', () => {
  it('renders columns with citation data', () => {
    const onViewDetail = vi.fn();
    renderWithCitationProviders(
      <ColumnsTestWrapper data={[mockCitation]} onViewDetail={onViewDetail} />
    );

    // Source title
    expect(screen.getByText('Example Article')).toBeDefined();
    // Domain
    expect(screen.getByText('example.com')).toBeDefined();
    // Platform
    expect(screen.getByText('ChatGPT')).toBeDefined();
    // Type badge
    expect(screen.getByText('Earned')).toBeDefined();
    // Position
    expect(screen.getByText('#3')).toBeDefined();
    // Sentiment
    expect(screen.getByText('Positive')).toBeDefined();
  });

  it('renders source URL as external link with noopener', () => {
    const onViewDetail = vi.fn();
    const { container } = renderWithCitationProviders(
      <ColumnsTestWrapper data={[mockCitation]} onViewDetail={onViewDetail} />
    );

    const link = container.querySelector('a[href="https://example.com/article"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('handles citation with no title gracefully', () => {
    const onViewDetail = vi.fn();
    renderWithCitationProviders(
      <ColumnsTestWrapper data={[mockCitationNoTitle]} onViewDetail={onViewDetail} />
    );

    // Falls back to domain when no title — domain appears in both link and domain display
    const elements = screen.getAllByText('example.com');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('handles malformed source URL gracefully', () => {
    const onViewDetail = vi.fn();
    const badUrlCitation = { ...mockCitation, sourceUrl: 'not-a-url', title: null };
    renderWithCitationProviders(
      <ColumnsTestWrapper data={[badUrlCitation]} onViewDetail={onViewDetail} />
    );

    // Falls back to raw URL string
    expect(screen.getByText('not-a-url')).toBeDefined();
  });

  it('formats date in locale-aware format', () => {
    const onViewDetail = vi.fn();
    const { container } = renderWithCitationProviders(
      <ColumnsTestWrapper data={[mockCitation]} onViewDetail={onViewDetail} />
    );

    // Should not show raw ISO string
    expect(container.textContent).not.toContain('2026-03-15T10:30:00Z');
    // Should contain formatted date
    expect(container.textContent).toContain('Mar');
    expect(container.textContent).toContain('2026');
  });

  it('renders without accessibility violations', async () => {
    const onViewDetail = vi.fn();
    const { container } = renderWithCitationProviders(
      <ColumnsTestWrapper data={[mockCitation]} onViewDetail={onViewDetail} />
    );

    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
