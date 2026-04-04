// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse } from './perplexity.citations';
import type { PerplexityChatResponse } from './perplexity.types';

function makeResponse(content: string, citations?: string[]): PerplexityChatResponse {
  return {
    id: 'resp_test',
    model: 'sonar',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(citations !== undefined && { citations }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

describe('extractCitationsFromResponse', () => {
  it('extracts citations from response', () => {
    const response = makeResponse(
      'Acme is a leading brand [1]. Their competitor is Beta Corp [2].',
      ['https://acme.com/about', 'https://beta.com/info']
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({
      url: 'https://acme.com/about',
      title: '',
      snippet: '',
      position: 1,
    });
    expect(citations[1]).toEqual({
      url: 'https://beta.com/info',
      title: '',
      snippet: '',
      position: 2,
    });
  });

  it('deduplicates citations by URL', () => {
    const response = makeResponse('Acme [1] is mentioned again [2] and again [3].', [
      'https://acme.com',
      'https://acme.com',
      'https://beta.com',
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0].url).toBe('https://acme.com');
    expect(citations[0].position).toBe(1);
    expect(citations[1].url).toBe('https://beta.com');
    expect(citations[1].position).toBe(2);
  });

  it('assigns positions in order of first appearance', () => {
    const response = makeResponse('A [1], B [2], C [3].', [
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations[0].position).toBe(1);
    expect(citations[1].position).toBe(2);
    expect(citations[2].position).toBe(3);
  });

  it('returns empty array when citations array is empty', () => {
    const response = makeResponse('No citations here.', []);

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when citations field is undefined', () => {
    const response = makeResponse('No citations here.');

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when choices are empty', () => {
    const response: PerplexityChatResponse = {
      id: 'resp_empty',
      model: 'sonar',
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns citations with empty title and snippet', () => {
    const response = makeResponse('Result [1].', ['https://example.com']);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe('');
    expect(citations[0].snippet).toBe('');
  });

  it('handles response with many citations', () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://source-${i + 1}.com`);
    const response = makeResponse('Many sources cited.', urls);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(10);
    expect(citations[0].position).toBe(1);
    expect(citations[9].position).toBe(10);
    expect(citations[9].url).toBe('https://source-10.com');
  });

  it('handles citations with inline markers but still returns empty snippets', () => {
    const response = makeResponse('According to research [1], brand visibility matters [2].', [
      'https://research.com',
      'https://visibility.com',
    ]);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0].snippet).toBe('');
    expect(citations[1].snippet).toBe('');
  });
});
