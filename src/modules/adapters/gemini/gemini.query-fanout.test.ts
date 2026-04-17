// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractQueryFanoutFromGeminiResponse } from './gemini.query-fanout';
import type { GeminiGenerateContentResponse } from './gemini.types';

function makeInput(rawResponse: unknown) {
  return {
    id: 'runres_test',
    platformId: 'gemini',
    interpolatedPrompt: 'What are the best project management tools?',
    rawResponse,
  };
}

describe('extractQueryFanoutFromGeminiResponse', () => {
  it('returns sub-queries with empty sources and dedup root sources', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [
        {
          finishReason: 'STOP',
          groundingMetadata: {
            webSearchQueries: ['best pm tools', 'team collaboration software'],
            groundingChunks: [
              { web: { uri: 'https://a.com', title: 'A' } },
              { web: { uri: 'https://b.com', title: 'B' } },
              { web: { uri: 'https://a.com', title: 'A (dup)' } },
            ],
          },
        },
      ],
    };

    const tree = extractQueryFanoutFromGeminiResponse(makeInput(response));

    expect(tree).not.toBeNull();
    expect(tree!.root.text).toBe('What are the best project management tools?');
    expect(tree!.subQueries).toHaveLength(2);
    expect(tree!.subQueries[0]).toEqual({ text: 'best pm tools', sources: [] });
    expect(tree!.rootSources).toHaveLength(2);
    expect(tree!.rootSources[0]).toEqual({ url: 'https://a.com', title: 'A' });
    expect(tree!.metadata).toEqual({ groundingAttribution: 'root-only', chunkCount: 3 });
  });

  it('returns null when groundingMetadata is absent', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [{ finishReason: 'STOP' }],
    };
    expect(extractQueryFanoutFromGeminiResponse(makeInput(response))).toBeNull();
  });

  it('returns null when both webSearchQueries and groundingChunks are empty', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [
        {
          finishReason: 'STOP',
          groundingMetadata: { webSearchQueries: [], groundingChunks: [] },
        },
      ],
    };
    expect(extractQueryFanoutFromGeminiResponse(makeInput(response))).toBeNull();
  });

  it('handles sub-queries with no grounding chunks', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [
        {
          finishReason: 'STOP',
          groundingMetadata: { webSearchQueries: ['only a sub-query'] },
        },
      ],
    };
    const tree = extractQueryFanoutFromGeminiResponse(makeInput(response));
    expect(tree).not.toBeNull();
    expect(tree!.subQueries).toHaveLength(1);
    expect(tree!.rootSources).toEqual([]);
    expect(tree!.metadata).toEqual({ groundingAttribution: 'root-only', chunkCount: 0 });
  });
});
