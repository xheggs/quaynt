// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse, brandMentionedInText } from './chatgpt.citations';
import type { OpenAIResponsesResponse } from './chatgpt.types';

function makeResponse(
  text: string,
  annotations: Array<{
    url: string;
    title: string;
    start_index: number;
    end_index: number;
  }> = []
): OpenAIResponsesResponse {
  return {
    id: 'resp_test',
    model: 'gpt-4o-mini',
    output: [
      {
        type: 'message',
        id: 'msg_1',
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
  };
}

describe('extractCitationsFromResponse', () => {
  it('extracts citations from annotations', () => {
    const text = 'Acme is a leading brand in the market today.';
    //            0123456789...                   30
    const response = makeResponse(text, [
      { url: 'https://example.com/acme', title: 'Acme Co', start_index: 0, end_index: 4 },
      { url: 'https://example.com/market', title: 'Market Report', start_index: 31, end_index: 37 },
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
    const response: OpenAIResponsesResponse = {
      id: 'resp_empty',
      model: 'gpt-4o-mini',
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('skips non-message output items', () => {
    const response: OpenAIResponsesResponse = {
      id: 'resp_mixed',
      model: 'gpt-4o-mini',
      output: [
        { type: 'web_search_call', id: 'ws_1', status: 'completed' },
        {
          type: 'message',
          id: 'msg_1',
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

describe('brandMentionedInText', () => {
  it('returns true when brand name appears in text', () => {
    expect(
      brandMentionedInText('Acme is a great company.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(
      brandMentionedInText('We recommend ACME for this use case.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(true);
  });

  it('returns true when an alias matches', () => {
    expect(
      brandMentionedInText('The company formerly known as Widgets Inc is great.', {
        name: 'Acme',
        aliases: ['Widgets Inc'],
      })
    ).toBe(true);
  });

  it('returns false when brand is not mentioned', () => {
    expect(
      brandMentionedInText('This text does not mention any brand.', {
        name: 'Acme',
        aliases: ['AcmeCorp'],
      })
    ).toBe(false);
  });

  it('uses word boundaries to avoid partial matches', () => {
    expect(
      brandMentionedInText('AcmeWidgets is a product.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(false);
  });

  it('handles regex special characters in brand names', () => {
    expect(
      brandMentionedInText('We use C++ for systems programming.', {
        name: 'C++',
        aliases: [],
      })
    ).toBe(true);
  });

  it('handles AT&T style brand names', () => {
    expect(
      brandMentionedInText('AT&T provides telecom services.', {
        name: 'AT&T',
        aliases: [],
      })
    ).toBe(true);
  });

  it('returns false for empty text', () => {
    expect(brandMentionedInText('', { name: 'Acme', aliases: [] })).toBe(false);
  });
});
