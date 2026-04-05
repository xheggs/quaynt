// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromSerpResult } from './aio.citations';
import type { SerpSearchResult } from './aio.types';

function makeResult(overrides?: Partial<SerpSearchResult>): SerpSearchResult {
  return {
    hasAiOverview: true,
    aiOverview: {
      textBlocks: [{ type: 'paragraph', text: 'Some text', referenceIndexes: [0, 1] }],
      references: [
        {
          title: 'First',
          link: 'https://first.com',
          snippet: 'First snippet',
          source: 'first.com',
          index: 0,
        },
        {
          title: 'Second',
          link: 'https://second.com',
          snippet: 'Second snippet',
          source: 'second.com',
          index: 1,
        },
      ],
    },
    rawResponse: {},
    ...overrides,
  };
}

describe('extractCitationsFromSerpResult', () => {
  it('extracts citations from references', () => {
    const citations = extractCitationsFromSerpResult(makeResult());

    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({
      url: 'https://first.com',
      title: 'First',
      snippet: 'First snippet',
      position: 1,
    });
    expect(citations[1]).toEqual({
      url: 'https://second.com',
      title: 'Second',
      snippet: 'Second snippet',
      position: 2,
    });
  });

  it('deduplicates by URL, keeping first occurrence', () => {
    const result = makeResult({
      aiOverview: {
        textBlocks: [],
        references: [
          {
            title: 'First',
            link: 'https://example.com',
            snippet: 'A',
            source: 'example.com',
            index: 0,
          },
          {
            title: 'Duplicate',
            link: 'https://example.com',
            snippet: 'B',
            source: 'example.com',
            index: 1,
          },
          {
            title: 'Other',
            link: 'https://other.com',
            snippet: 'C',
            source: 'other.com',
            index: 2,
          },
        ],
      },
    });

    const citations = extractCitationsFromSerpResult(result);

    expect(citations).toHaveLength(2);
    expect(citations[0].title).toBe('First');
    expect(citations[0].position).toBe(1);
    expect(citations[1].url).toBe('https://other.com');
    expect(citations[1].position).toBe(2);
  });

  it('returns empty array when hasAiOverview is false', () => {
    const result = makeResult({ hasAiOverview: false });
    expect(extractCitationsFromSerpResult(result)).toEqual([]);
  });

  it('returns empty array when aiOverview is undefined', () => {
    const result: SerpSearchResult = {
      hasAiOverview: true,
      aiOverview: undefined,
      rawResponse: {},
    };
    expect(extractCitationsFromSerpResult(result)).toEqual([]);
  });

  it('returns empty array when references array is empty', () => {
    const result = makeResult({
      aiOverview: {
        textBlocks: [{ type: 'paragraph', text: 'Text', referenceIndexes: [] }],
        references: [],
      },
    });
    expect(extractCitationsFromSerpResult(result)).toEqual([]);
  });

  it('uses safe defaults for missing optional fields', () => {
    const result = makeResult({
      aiOverview: {
        textBlocks: [],
        references: [{ title: '', link: 'https://example.com', snippet: '', source: '', index: 0 }],
      },
    });

    const citations = extractCitationsFromSerpResult(result);

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe('');
    expect(citations[0].snippet).toBe('');
  });

  it('skips references with falsy link', () => {
    const result = makeResult({
      aiOverview: {
        textBlocks: [],
        references: [
          { title: 'No Link', link: '', snippet: 'S', source: 's.com', index: 0 },
          {
            title: 'Has Link',
            link: 'https://valid.com',
            snippet: 'V',
            source: 'valid.com',
            index: 1,
          },
        ],
      },
    });

    const citations = extractCitationsFromSerpResult(result);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://valid.com');
    expect(citations[0].position).toBe(1);
  });
});
