// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse, extractWebSearchErrors } from './claude.citations';
import type { ClaudeMessagesResponse, ClaudeContentBlock } from './claude.types';

function makeResponse(contentBlocks: ClaudeContentBlock[]): ClaudeMessagesResponse {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: contentBlocks,
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function makeTextBlock(
  text: string,
  citations: Array<{ url: string; title: string; cited_text: string }> = []
): ClaudeContentBlock {
  return {
    type: 'text',
    text,
    citations: citations.map((c) => ({
      type: 'web_search_result_location' as const,
      url: c.url,
      title: c.title,
      encrypted_index: 'enc_idx',
      cited_text: c.cited_text,
    })),
  };
}

describe('extractCitationsFromResponse', () => {
  it('extracts citations from text blocks', () => {
    const response = makeResponse([
      makeTextBlock('Acme Corp is a leading brand.', [
        { url: 'https://acme.com', title: 'Acme Corp', cited_text: 'leading brand in widgets' },
        {
          url: 'https://example.com/report',
          title: 'Market Report',
          cited_text: 'brand visibility',
        },
      ]),
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({
      url: 'https://acme.com',
      title: 'Acme Corp',
      snippet: 'leading brand in widgets',
      position: 1,
    });
    expect(citations[1]).toEqual({
      url: 'https://example.com/report',
      title: 'Market Report',
      snippet: 'brand visibility',
      position: 2,
    });
  });

  it('deduplicates citations by URL', () => {
    const response = makeResponse([
      makeTextBlock('First mention.', [
        { url: 'https://acme.com', title: 'Acme', cited_text: 'first snippet' },
      ]),
      makeTextBlock('Second mention.', [
        { url: 'https://acme.com', title: 'Acme (dup)', cited_text: 'second snippet' },
      ]),
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://acme.com');
    expect(citations[0].snippet).toBe('first snippet');
    expect(citations[0].position).toBe(1);
  });

  it('assigns positions in order of first appearance', () => {
    const response = makeResponse([
      makeTextBlock('Text with multiple citations.', [
        { url: 'https://a.com', title: 'A', cited_text: 'a text' },
        { url: 'https://b.com', title: 'B', cited_text: 'b text' },
        { url: 'https://c.com', title: 'C', cited_text: 'c text' },
      ]),
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations[0].position).toBe(1);
    expect(citations[1].position).toBe(2);
    expect(citations[2].position).toBe(3);
  });

  it('maintains position numbering across multiple text blocks', () => {
    const response = makeResponse([
      makeTextBlock('First block.', [{ url: 'https://a.com', title: 'A', cited_text: 'a text' }]),
      makeTextBlock('Second block.', [{ url: 'https://b.com', title: 'B', cited_text: 'b text' }]),
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0].position).toBe(1);
    expect(citations[1].position).toBe(2);
  });

  it('returns empty array when text block has no citations', () => {
    const response = makeResponse([{ type: 'text', text: 'No citations here.' }]);

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when text block has empty citations array', () => {
    const response = makeResponse([{ type: 'text', text: 'No citations here.', citations: [] }]);

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when response has no content blocks', () => {
    const response = makeResponse([]);

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('skips non-text content blocks', () => {
    const response = makeResponse([
      {
        type: 'web_search_tool_result',
        content: [
          {
            type: 'web_search_result',
            url: 'https://example.com',
            title: 'Example',
            encrypted_index: 'enc',
          },
        ],
      },
      makeTextBlock('After search.', [
        { url: 'https://example.com', title: 'Example', cited_text: 'example text' },
      ]),
    ]);

    const citations = extractCitationsFromResponse(response);
    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://example.com');
  });

  it('handles mixed content blocks (text + tool_use + web_search_tool_result)', () => {
    const response = makeResponse([
      {
        type: 'tool_use',
        id: 'tu_1',
        name: 'web_search',
        input: {},
      },
      {
        type: 'web_search_tool_result',
        content: [
          {
            type: 'web_search_result',
            url: 'https://example.com',
            title: 'Example',
            encrypted_index: 'enc',
          },
        ],
      },
      makeTextBlock('Result text.', [
        { url: 'https://example.com', title: 'Example', cited_text: 'result snippet' },
      ]),
    ]);

    const citations = extractCitationsFromResponse(response);
    expect(citations).toHaveLength(1);
    expect(citations[0].position).toBe(1);
  });

  it('defaults title to empty string when missing', () => {
    const response = makeResponse([
      {
        type: 'text',
        text: 'Some text.',
        citations: [
          {
            type: 'web_search_result_location',
            url: 'https://example.com',
            title: undefined as unknown as string,
            encrypted_index: 'enc',
            cited_text: 'snippet',
          },
        ],
      },
    ]);

    const citations = extractCitationsFromResponse(response);
    expect(citations[0].title).toBe('');
  });

  it('defaults cited_text to empty string when missing', () => {
    const response = makeResponse([
      {
        type: 'text',
        text: 'Some text.',
        citations: [
          {
            type: 'web_search_result_location',
            url: 'https://example.com',
            title: 'Example',
            encrypted_index: 'enc',
            cited_text: undefined as unknown as string,
          },
        ],
      },
    ]);

    const citations = extractCitationsFromResponse(response);
    expect(citations[0].snippet).toBe('');
  });
});

describe('extractWebSearchErrors', () => {
  it('detects web search error in response', () => {
    const response = makeResponse([
      {
        type: 'web_search_tool_result',
        content: {
          type: 'web_search_tool_result_error',
          error_code: 'too_many_requests',
        },
      },
      { type: 'text', text: 'Some fallback text.' },
    ]);

    const errors = extractWebSearchErrors(response);
    expect(errors).toEqual(['too_many_requests']);
  });

  it('detects multiple web search errors', () => {
    const response = makeResponse([
      {
        type: 'web_search_tool_result',
        content: {
          type: 'web_search_tool_result_error',
          error_code: 'too_many_requests',
        },
      },
      {
        type: 'web_search_tool_result',
        content: {
          type: 'web_search_tool_result_error',
          error_code: 'unavailable',
        },
      },
    ]);

    const errors = extractWebSearchErrors(response);
    expect(errors).toEqual(['too_many_requests', 'unavailable']);
  });

  it('returns empty array when no web search errors', () => {
    const response = makeResponse([
      {
        type: 'web_search_tool_result',
        content: [
          {
            type: 'web_search_result',
            url: 'https://example.com',
            title: 'Example',
            encrypted_index: 'enc',
          },
        ],
      },
      makeTextBlock('Result.', []),
    ]);

    const errors = extractWebSearchErrors(response);
    expect(errors).toEqual([]);
  });

  it('returns empty array when response has no web_search_tool_result blocks', () => {
    const response = makeResponse([makeTextBlock('Just text.', [])]);

    const errors = extractWebSearchErrors(response);
    expect(errors).toEqual([]);
  });

  it('returns empty array when response has no content blocks', () => {
    const response = makeResponse([]);

    const errors = extractWebSearchErrors(response);
    expect(errors).toEqual([]);
  });

  it('handles all known error codes', () => {
    const errorCodes = [
      'too_many_requests',
      'invalid_input',
      'max_uses_exceeded',
      'query_too_long',
      'unavailable',
    ];

    for (const errorCode of errorCodes) {
      const response = makeResponse([
        {
          type: 'web_search_tool_result',
          content: {
            type: 'web_search_tool_result_error',
            error_code: errorCode,
          },
        },
      ]);

      const errors = extractWebSearchErrors(response);
      expect(errors).toEqual([errorCode]);
    }
  });
});
