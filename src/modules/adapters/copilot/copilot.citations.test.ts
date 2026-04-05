// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromCopilotResult } from './copilot.citations';
import type { CopilotSearchResult } from './copilot.types';

function makeResult(overrides?: Partial<CopilotSearchResult>): CopilotSearchResult {
  return {
    hasCopilotAnswer: true,
    copilotAnswer: {
      header: 'Header text',
      textBlocks: [{ type: 'paragraph', text: 'Content', referenceIndexes: [1] }],
      references: [
        {
          index: 1,
          title: 'Example',
          link: 'https://example.com',
          snippet: 'Snippet',
          source: 'example.com',
        },
        {
          index: 2,
          title: 'Other',
          link: 'https://other.com',
          snippet: 'Other snippet',
          source: 'other.com',
        },
      ],
    },
    rawResponse: {},
    requestId: 'req-1',
    ...overrides,
  };
}

describe('extractCitationsFromCopilotResult', () => {
  // -- Basic extraction -------------------------------------------------------

  it('extracts citations from Copilot references', () => {
    const citations = extractCitationsFromCopilotResult(makeResult());

    expect(citations).toHaveLength(2);
    expect(citations[0].url).toBe('https://example.com');
    expect(citations[0].title).toBe('Example');
    expect(citations[0].snippet).toBe('Snippet');
    expect(citations[0].position).toBe(1);
    expect(citations[1].url).toBe('https://other.com');
    expect(citations[1].position).toBe(2);
  });

  // -- Deduplication ----------------------------------------------------------

  it('deduplicates by URL, keeping first occurrence', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [
          {
            index: 1,
            title: 'First',
            link: 'https://example.com',
            snippet: 'First snippet',
            source: 'example.com',
          },
          {
            index: 2,
            title: 'Dupe',
            link: 'https://example.com',
            snippet: 'Dupe snippet',
            source: 'example.com',
          },
          {
            index: 3,
            title: 'Unique',
            link: 'https://unique.com',
            snippet: 'Unique',
            source: 'unique.com',
          },
        ],
      },
    });

    const citations = extractCitationsFromCopilotResult(result);

    expect(citations).toHaveLength(2);
    expect(citations[0].title).toBe('First');
    expect(citations[1].url).toBe('https://unique.com');
  });

  // -- Empty / absent cases ---------------------------------------------------

  it('returns empty array when hasCopilotAnswer is false', () => {
    const result = makeResult({ hasCopilotAnswer: false });
    expect(extractCitationsFromCopilotResult(result)).toHaveLength(0);
  });

  it('returns empty array when copilotAnswer is undefined', () => {
    const result = makeResult({ copilotAnswer: undefined });
    expect(extractCitationsFromCopilotResult(result)).toHaveLength(0);
  });

  it('returns empty array when references is empty', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [],
      },
    });
    expect(extractCitationsFromCopilotResult(result)).toHaveLength(0);
  });

  // -- References with missing fields -----------------------------------------

  it('skips references with no link', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [
          { index: 1, title: 'No Link', link: '', snippet: 'test', source: 'test.com' },
          {
            index: 2,
            title: 'Has Link',
            link: 'https://valid.com',
            snippet: 'ok',
            source: 'valid.com',
          },
        ],
      },
    });

    const citations = extractCitationsFromCopilotResult(result);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://valid.com');
  });

  it('uses safe defaults for missing optional fields', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [{ index: 0, title: '', link: 'https://example.com', snippet: '', source: '' }],
      },
    });

    const citations = extractCitationsFromCopilotResult(result);

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe('');
    expect(citations[0].snippet).toBe('');
  });

  // -- Position numbering -----------------------------------------------------

  it('uses reference index when available and positive', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [
          { index: 5, title: 'A', link: 'https://a.com', snippet: '', source: '' },
          { index: 10, title: 'B', link: 'https://b.com', snippet: '', source: '' },
        ],
      },
    });

    const citations = extractCitationsFromCopilotResult(result);

    expect(citations[0].position).toBe(5);
    expect(citations[1].position).toBe(10);
  });

  it('uses counter when reference index is 0', () => {
    const result = makeResult({
      copilotAnswer: {
        header: 'Header',
        textBlocks: [],
        references: [
          { index: 0, title: 'A', link: 'https://a.com', snippet: '', source: '' },
          { index: 0, title: 'B', link: 'https://b.com', snippet: '', source: '' },
        ],
      },
    });

    const citations = extractCitationsFromCopilotResult(result);

    expect(citations[0].position).toBe(1);
    expect(citations[1].position).toBe(2);
  });
});
