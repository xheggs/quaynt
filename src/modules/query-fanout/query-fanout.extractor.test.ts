// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractObservedFanout } from './query-fanout.extractor';

describe('extractObservedFanout dispatcher', () => {
  it('returns null for unsupported platforms', () => {
    for (const platformId of ['perplexity', 'claude', 'grok', 'copilot', 'deepseek', 'unknown']) {
      expect(
        extractObservedFanout({
          id: 'runres_test',
          platformId,
          interpolatedPrompt: 'Test',
          rawResponse: {},
        })
      ).toBeNull();
    }
  });

  it('dispatches gemini to the gemini extractor', () => {
    const tree = extractObservedFanout({
      id: 'runres_1',
      platformId: 'gemini',
      interpolatedPrompt: 'Prompt',
      rawResponse: {
        candidates: [
          {
            finishReason: 'STOP',
            groundingMetadata: { webSearchQueries: ['a'], groundingChunks: [] },
          },
        ],
      },
    });
    expect(tree).not.toBeNull();
    expect(tree!.subQueries[0].text).toBe('a');
  });

  it('dispatches aio to the aio extractor', () => {
    const tree = extractObservedFanout({
      id: 'runres_2',
      platformId: 'aio',
      interpolatedPrompt: 'Prompt',
      rawResponse: {
        hasAiOverview: true,
        aiOverview: {
          textBlocks: [{ type: 'paragraph', text: 'block', referenceIndexes: [0] }],
          references: [
            { title: 'A', link: 'https://a.com', snippet: '', source: 'a.com', index: 0 },
          ],
        },
        rawResponse: {},
      },
    });
    expect(tree).not.toBeNull();
    expect(tree!.subQueries[0].sources[0].url).toBe('https://a.com');
  });

  it('dispatches chatgpt to the chatgpt extractor', () => {
    const tree = extractObservedFanout({
      id: 'runres_3',
      platformId: 'chatgpt',
      interpolatedPrompt: 'Prompt',
      rawResponse: {
        id: 'resp',
        model: 'gpt-4o-mini',
        output: [
          {
            type: 'web_search_call',
            id: 'ws_1',
            status: 'completed',
            action: { type: 'search', query: 'sub-query' },
          },
        ],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      },
    });
    expect(tree).not.toBeNull();
    expect(tree!.subQueries[0].text).toBe('sub-query');
  });
});
