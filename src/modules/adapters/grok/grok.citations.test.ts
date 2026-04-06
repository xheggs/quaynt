// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse, getCitationSources } from './grok.citations';
import type { GrokResponsesResponse } from './grok.types';

function makeResponse(
  text: string,
  annotations: Array<{
    url: string;
    title: string;
    start_index: number;
    end_index: number;
  }> = [],
  topLevelCitations?: Array<{ url: string; title?: string; snippet?: string; source: 'web' | 'x' }>
): GrokResponsesResponse {
  return {
    id: 'resp_test',
    model: 'grok-4-1-fast-non-reasoning',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text,
            annotations: annotations.map((a) => ({
              type: 'url_citation' as const,
              ...a,
            })),
          },
        ],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    ...(topLevelCitations && { citations: topLevelCitations }),
  };
}

// -- extractCitationsFromResponse -----------------------------------------------

describe('extractCitationsFromResponse', () => {
  describe('annotation citations', () => {
    it('extracts citations from annotations', () => {
      const text = 'Acme is a leading brand in the market today.';
      const response = makeResponse(text, [
        { url: 'https://example.com/acme', title: 'Acme Co', start_index: 0, end_index: 4 },
        {
          url: 'https://example.com/market',
          title: 'Market Report',
          start_index: 31,
          end_index: 37,
        },
      ]);

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(2);
      expect(citations[0]).toEqual({
        url: 'https://example.com/acme',
        title: 'Acme Co',
        snippet: 'Acme',
        position: 1,
      });
      expect(citations[1]).toEqual({
        url: 'https://example.com/market',
        title: 'Market Report',
        snippet: 'market',
        position: 2,
      });
    });

    it('deduplicates citations by URL', () => {
      const text = 'First mention of Acme and then Acme again.';
      const response = makeResponse(text, [
        { url: 'https://example.com/acme', title: 'Acme Co', start_index: 0, end_index: 5 },
        { url: 'https://example.com/acme', title: 'Acme Co (dup)', start_index: 20, end_index: 24 },
      ]);

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(1);
      expect(citations[0].url).toBe('https://example.com/acme');
      expect(citations[0].position).toBe(1);
    });

    it('assigns positions in order of first appearance', () => {
      const text = 'A, B, and C are all mentioned.';
      const response = makeResponse(text, [
        { url: 'https://a.com', title: 'A', start_index: 0, end_index: 1 },
        { url: 'https://b.com', title: 'B', start_index: 3, end_index: 4 },
        { url: 'https://c.com', title: 'C', start_index: 10, end_index: 11 },
      ]);

      const citations = extractCitationsFromResponse(response);

      expect(citations[0].position).toBe(1);
      expect(citations[1].position).toBe(2);
      expect(citations[2].position).toBe(3);
    });

    it('returns empty array when response has no annotations', () => {
      const response = makeResponse('No citations here.', []);

      expect(extractCitationsFromResponse(response)).toEqual([]);
    });

    it('returns empty array when response has no output items', () => {
      const response: GrokResponsesResponse = {
        id: 'resp_empty',
        model: 'grok-4-1-fast-non-reasoning',
        output: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      };

      expect(extractCitationsFromResponse(response)).toEqual([]);
    });

    it('skips non-message output items', () => {
      const response: GrokResponsesResponse = {
        id: 'resp_mixed',
        model: 'grok-4-1-fast-non-reasoning',
        output: [
          { type: 'web_search_call', id: 'ws_1', status: 'completed' },
          { type: 'x_search_call', id: 'xs_1', status: 'completed' },
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Result from search.',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com',
                    title: 'Example',
                    start_index: 0,
                    end_index: 6,
                  },
                ],
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };

      const citations = extractCitationsFromResponse(response);
      expect(citations).toHaveLength(1);
      expect(citations[0].url).toBe('https://example.com');
    });

    it('extracts snippet from text using start_index and end_index', () => {
      const text = 'According to research, brand visibility matters.';
      const response = makeResponse(text, [
        { url: 'https://research.com', title: 'Research', start_index: 13, end_index: 21 },
      ]);

      const citations = extractCitationsFromResponse(response);
      expect(citations[0].snippet).toBe('research');
    });

    it('returns empty snippet when indices are invalid', () => {
      const text = 'Short text.';
      const response = makeResponse(text, [
        { url: 'https://example.com', title: 'Example', start_index: -1, end_index: 0 },
      ]);

      const citations = extractCitationsFromResponse(response);
      expect(citations[0].snippet).toBe('');
    });
  });

  describe('top-level citations (xAI extension)', () => {
    it('supplements with unique URLs from top-level citations', () => {
      const text = 'Acme is trending.';
      const response = makeResponse(
        text,
        [{ url: 'https://acme.com', title: 'Acme', start_index: 0, end_index: 4 }],
        [
          { url: 'https://acme.com', title: 'Acme', source: 'web' },
          {
            url: 'https://x.com/user/status/123',
            title: '@user tweet',
            snippet: 'Acme is great',
            source: 'x',
          },
        ]
      );

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(2);
      // First from annotations
      expect(citations[0].url).toBe('https://acme.com');
      expect(citations[0].position).toBe(1);
      // Second from top-level (unique URL)
      expect(citations[1].url).toBe('https://x.com/user/status/123');
      expect(citations[1].title).toBe('@user tweet');
      expect(citations[1].snippet).toBe('Acme is great');
      expect(citations[1].position).toBe(2);
    });

    it('deduplicates across annotations and top-level citations', () => {
      const text = 'Acme is great.';
      const response = makeResponse(
        text,
        [{ url: 'https://acme.com', title: 'Acme', start_index: 0, end_index: 4 }],
        [{ url: 'https://acme.com', title: 'Acme Corp', source: 'web' }]
      );

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(1);
      // Annotation version takes precedence
      expect(citations[0].title).toBe('Acme');
    });

    it('extracts only from top-level when no annotations exist', () => {
      const response: GrokResponsesResponse = {
        id: 'resp_top_only',
        model: 'grok-4-1-fast-non-reasoning',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Some text.', annotations: [] }],
          },
        ],
        usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        citations: [
          { url: 'https://x.com/post/1', title: 'Tweet 1', snippet: 'content', source: 'x' },
          { url: 'https://example.com', title: 'Web page', source: 'web' },
        ],
      };

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(2);
      expect(citations[0].url).toBe('https://x.com/post/1');
      expect(citations[0].position).toBe(1);
      expect(citations[1].url).toBe('https://example.com');
      expect(citations[1].position).toBe(2);
    });

    it('handles missing title and snippet in top-level citations', () => {
      const response = makeResponse('Text.', [], [{ url: 'https://x.com/post/1', source: 'x' }]);

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(1);
      expect(citations[0].title).toBe('');
      expect(citations[0].snippet).toBe('');
    });

    it('returns empty array when no annotations and no top-level citations', () => {
      const response = makeResponse('No citations.', []);

      expect(extractCitationsFromResponse(response)).toEqual([]);
    });

    it('handles undefined top-level citations array', () => {
      const response: GrokResponsesResponse = {
        id: 'resp_no_top',
        model: 'grok-4-1-fast-non-reasoning',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Acme info.',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://acme.com',
                    title: 'Acme',
                    start_index: 0,
                    end_index: 4,
                  },
                ],
              },
            ],
          },
        ],
        usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        // No citations field
      };

      const citations = extractCitationsFromResponse(response);
      expect(citations).toHaveLength(1);
      expect(citations[0].url).toBe('https://acme.com');
    });

    it('continues position numbering from annotations into top-level', () => {
      const text = 'A and B from search.';
      const response = makeResponse(
        text,
        [
          { url: 'https://a.com', title: 'A', start_index: 0, end_index: 1 },
          { url: 'https://b.com', title: 'B', start_index: 6, end_index: 7 },
        ],
        [
          { url: 'https://x.com/post/1', title: 'Tweet', source: 'x' },
          { url: 'https://x.com/post/2', title: 'Tweet 2', source: 'x' },
        ]
      );

      const citations = extractCitationsFromResponse(response);

      expect(citations).toHaveLength(4);
      expect(citations[0].position).toBe(1); // annotation
      expect(citations[1].position).toBe(2); // annotation
      expect(citations[2].position).toBe(3); // top-level
      expect(citations[3].position).toBe(4); // top-level
    });
  });
});

// -- getCitationSources -------------------------------------------------------

describe('getCitationSources', () => {
  it('returns map of URL to source type', () => {
    const response = makeResponse(
      'Text.',
      [],
      [
        { url: 'https://example.com', title: 'Web', source: 'web' },
        { url: 'https://x.com/post/1', title: 'Tweet', source: 'x' },
      ]
    );

    const sources = getCitationSources(response);

    expect(sources.get('https://example.com')).toBe('web');
    expect(sources.get('https://x.com/post/1')).toBe('x');
    expect(sources.size).toBe(2);
  });

  it('returns empty map when no citations array', () => {
    const response: GrokResponsesResponse = {
      id: 'resp_no_cites',
      model: 'grok-4-1-fast-non-reasoning',
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };

    const sources = getCitationSources(response);
    expect(sources.size).toBe(0);
  });

  it('handles mixed web and x sources', () => {
    const response = makeResponse(
      'Text.',
      [],
      [
        { url: 'https://a.com', source: 'web' },
        { url: 'https://b.com', source: 'web' },
        { url: 'https://x.com/1', source: 'x' },
      ]
    );

    const sources = getCitationSources(response);

    expect(sources.get('https://a.com')).toBe('web');
    expect(sources.get('https://b.com')).toBe('web');
    expect(sources.get('https://x.com/1')).toBe('x');
    expect(sources.size).toBe(3);
  });

  it('returns empty map when citations array is empty', () => {
    const response: GrokResponsesResponse = {
      id: 'resp_empty_cites',
      model: 'grok-4-1-fast-non-reasoning',
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      citations: [],
    };

    const sources = getCitationSources(response);
    expect(sources.size).toBe(0);
  });
});
