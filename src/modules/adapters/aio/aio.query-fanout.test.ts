// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractQueryFanoutFromAioResponse } from './aio.query-fanout';
import type { SerpSearchResult } from './aio.types';

function makeInput(rawResponse: unknown) {
  return {
    id: 'runres_test',
    platformId: 'aio',
    interpolatedPrompt: 'What are the best project management tools?',
    rawResponse,
  };
}

function makeSerpResult(overview: SerpSearchResult['aiOverview'] | undefined): SerpSearchResult {
  return {
    hasAiOverview: !!overview,
    aiOverview: overview,
    rawResponse: {},
  };
}

describe('extractQueryFanoutFromAioResponse', () => {
  it('maps text blocks to sub-queries with per-block sources', () => {
    const response = makeSerpResult({
      textBlocks: [
        {
          type: 'paragraph',
          text: 'Asana is a popular choice for teams.',
          referenceIndexes: [0, 1],
        },
        {
          type: 'list',
          text: 'Trello offers a Kanban-style interface.',
          referenceIndexes: [2],
        },
      ],
      references: [
        { title: 'Asana', link: 'https://asana.com', snippet: '', source: 'asana.com', index: 0 },
        {
          title: 'Forbes',
          link: 'https://forbes.com',
          snippet: '',
          source: 'forbes.com',
          index: 1,
        },
        {
          title: 'Trello',
          link: 'https://trello.com',
          snippet: '',
          source: 'trello.com',
          index: 2,
        },
      ],
    });

    const tree = extractQueryFanoutFromAioResponse(makeInput(response));

    expect(tree).not.toBeNull();
    expect(tree!.subQueries).toHaveLength(2);
    expect(tree!.subQueries[0].text).toBe('Asana is a popular choice for teams.');
    expect(tree!.subQueries[0].sources).toHaveLength(2);
    expect(tree!.subQueries[0].sources[0]).toEqual({ url: 'https://asana.com', title: 'Asana' });
    expect(tree!.subQueries[0].metadata).toEqual({
      blockType: 'paragraph',
      fullText: 'Asana is a popular choice for teams.',
    });
    expect(tree!.subQueries[1].sources).toHaveLength(1);
    expect(tree!.rootSources).toEqual([]);
  });

  it('truncates long block text and keeps the full text in metadata', () => {
    const longText = 'a'.repeat(200);
    const response = makeSerpResult({
      textBlocks: [{ type: 'paragraph', text: longText, referenceIndexes: [0] }],
      references: [{ title: 'A', link: 'https://a.com', snippet: '', source: 'a.com', index: 0 }],
    });

    const tree = extractQueryFanoutFromAioResponse(makeInput(response));

    expect(tree).not.toBeNull();
    const label = tree!.subQueries[0].text;
    expect(label.length).toBeLessThanOrEqual(121);
    expect(label.endsWith('…')).toBe(true);
    expect(tree!.subQueries[0].metadata?.fullText).toBe(longText);
  });

  it('dedupes sources by URL within a block', () => {
    const response = makeSerpResult({
      textBlocks: [{ type: 'paragraph', text: 'Body', referenceIndexes: [0, 0, 1] }],
      references: [
        { title: 'A', link: 'https://a.com', snippet: '', source: 'a.com', index: 0 },
        { title: 'B', link: 'https://b.com', snippet: '', source: 'b.com', index: 1 },
      ],
    });
    const tree = extractQueryFanoutFromAioResponse(makeInput(response));
    expect(tree!.subQueries[0].sources).toHaveLength(2);
  });

  it('skips blocks with empty referenceIndexes', () => {
    const response = makeSerpResult({
      textBlocks: [
        { type: 'heading', text: 'Header', referenceIndexes: [] },
        { type: 'paragraph', text: 'Body', referenceIndexes: [0] },
      ],
      references: [{ title: 'A', link: 'https://a.com', snippet: '', source: 'a.com', index: 0 }],
    });
    const tree = extractQueryFanoutFromAioResponse(makeInput(response));
    expect(tree!.subQueries).toHaveLength(1);
    expect(tree!.subQueries[0].text).toBe('Body');
  });

  it('returns null when overview is absent', () => {
    const response = makeSerpResult(undefined);
    expect(extractQueryFanoutFromAioResponse(makeInput(response))).toBeNull();
  });

  it('returns null when overview has no text blocks', () => {
    const response = makeSerpResult({ textBlocks: [], references: [] });
    expect(extractQueryFanoutFromAioResponse(makeInput(response))).toBeNull();
  });

  it('returns null when no blocks have referenceIndexes', () => {
    const response = makeSerpResult({
      textBlocks: [{ type: 'heading', text: 'Header', referenceIndexes: [] }],
      references: [],
    });
    expect(extractQueryFanoutFromAioResponse(makeInput(response))).toBeNull();
  });
});
