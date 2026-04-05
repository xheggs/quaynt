// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse } from './gemini.citations';
import type { GeminiGenerateContentResponse } from './gemini.types';

function makeResponse(
  groundingChunks?: Array<{ web?: { uri: string; title: string } }>,
  groundingSupports?: Array<{
    segment: { text?: string; startIndex?: number; endIndex?: number };
    groundingChunkIndices: number[];
    confidenceScores: number[];
  }>,
  text = 'Acme Corp is a leader in widgets.'
): GeminiGenerateContentResponse {
  return {
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
        groundingMetadata: {
          groundingChunks,
          groundingSupports,
          webSearchQueries: ['Acme Corp widgets'],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 15,
      totalTokenCount: 25,
    },
    modelVersion: 'gemini-2.5-flash',
  };
}

describe('extractCitationsFromResponse', () => {
  it('extracts citations from grounding chunks with supports', () => {
    const response = makeResponse(
      [
        { web: { uri: 'https://acme.com', title: 'Acme Corp' } },
        { web: { uri: 'https://widgets.org/report', title: 'Widget Market Report' } },
      ],
      [
        {
          segment: { text: 'Acme Corp', startIndex: 0, endIndex: 9 },
          groundingChunkIndices: [0],
          confidenceScores: [0.95],
        },
        {
          segment: { text: 'leader in widgets', startIndex: 15, endIndex: 32 },
          groundingChunkIndices: [0, 1],
          confidenceScores: [0.7, 0.85],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({
      url: 'https://acme.com',
      title: 'Acme Corp',
      snippet: 'Acme Corp leader in widgets',
      position: 1,
    });
    expect(citations[1]).toEqual({
      url: 'https://widgets.org/report',
      title: 'Widget Market Report',
      snippet: 'leader in widgets',
      position: 2,
    });
  });

  it('deduplicates citations by URL', () => {
    const response = makeResponse(
      [
        { web: { uri: 'https://acme.com', title: 'Acme Corp' } },
        { web: { uri: 'https://acme.com', title: 'Acme Corp (duplicate)' } },
      ],
      [
        {
          segment: { text: 'first mention' },
          groundingChunkIndices: [0],
          confidenceScores: [0.9],
        },
        {
          segment: { text: 'second mention' },
          groundingChunkIndices: [1],
          confidenceScores: [0.8],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://acme.com');
    expect(citations[0].title).toBe('Acme Corp');
    expect(citations[0].snippet).toBe('first mention second mention');
    expect(citations[0].position).toBe(1);
  });

  it('assigns positions in 1-based chunk order', () => {
    const response = makeResponse(
      [
        { web: { uri: 'https://a.com', title: 'A' } },
        { web: { uri: 'https://b.com', title: 'B' } },
        { web: { uri: 'https://c.com', title: 'C' } },
      ],
      []
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations[0].position).toBe(1);
    expect(citations[1].position).toBe(2);
    expect(citations[2].position).toBe(3);
  });

  it('returns empty array when response has no candidates', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 0, totalTokenCount: 5 },
    };

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when candidates is undefined', () => {
    const response: GeminiGenerateContentResponse = {};

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when groundingMetadata is absent', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: 'Hello' }] },
          finishReason: 'STOP',
        },
      ],
    };

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when groundingChunks is absent', () => {
    const response: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: 'Hello' }] },
          groundingMetadata: {
            groundingSupports: [
              {
                segment: { text: 'some text' },
                groundingChunkIndices: [0],
                confidenceScores: [0.9],
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('returns empty array when groundingChunks is empty', () => {
    const response = makeResponse([], []);

    expect(extractCitationsFromResponse(response)).toEqual([]);
  });

  it('creates citations with empty snippet when groundingSupports is absent', () => {
    const response = makeResponse(
      [{ web: { uri: 'https://example.com', title: 'Example' } }],
      undefined
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].snippet).toBe('');
  });

  it('creates citations with empty snippet when no supports reference the chunk', () => {
    const response = makeResponse(
      [
        { web: { uri: 'https://a.com', title: 'A' } },
        { web: { uri: 'https://b.com', title: 'B' } },
      ],
      [
        {
          segment: { text: 'only references B' },
          groundingChunkIndices: [1],
          confidenceScores: [0.9],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0].url).toBe('https://a.com');
    expect(citations[0].snippet).toBe('');
    expect(citations[1].url).toBe('https://b.com');
    expect(citations[1].snippet).toBe('only references B');
  });

  it('skips chunks without web property', () => {
    const response = makeResponse(
      [
        { web: { uri: 'https://a.com', title: 'A' } },
        {}, // No web property
        { web: { uri: 'https://c.com', title: 'C' } },
      ],
      []
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(2);
    expect(citations[0].url).toBe('https://a.com');
    expect(citations[0].position).toBe(1);
    expect(citations[1].url).toBe('https://c.com');
    expect(citations[1].position).toBe(2);
  });

  it('skips chunks with empty URI', () => {
    const response = makeResponse(
      [{ web: { uri: '', title: 'Empty' } }, { web: { uri: 'https://valid.com', title: 'Valid' } }],
      []
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe('https://valid.com');
    expect(citations[0].position).toBe(1);
  });

  it('joins multiple support segments for same chunk', () => {
    const response = makeResponse(
      [{ web: { uri: 'https://source.com', title: 'Source' } }],
      [
        {
          segment: { text: 'First segment.' },
          groundingChunkIndices: [0],
          confidenceScores: [0.9],
        },
        {
          segment: { text: 'Second segment.' },
          groundingChunkIndices: [0],
          confidenceScores: [0.85],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].snippet).toBe('First segment. Second segment.');
  });

  it('handles supports with missing segment text', () => {
    const response = makeResponse(
      [{ web: { uri: 'https://source.com', title: 'Source' } }],
      [
        {
          segment: { startIndex: 0, endIndex: 10 },
          groundingChunkIndices: [0],
          confidenceScores: [0.9],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].snippet).toBe('');
  });

  it('defaults title to empty string when chunk.web.title is missing', () => {
    // TypeScript types say title is required, but defensive coding for API responses
    const response = makeResponse([{ web: { uri: 'https://notitle.com', title: '' } }], []);

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe('');
  });

  it('handles redirect URIs from vertexaisearch.cloud.google.com', () => {
    const redirectUri = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/example123';
    const response = makeResponse(
      [{ web: { uri: redirectUri, title: 'Redirected Source' } }],
      [
        {
          segment: { text: 'grounded content' },
          groundingChunkIndices: [0],
          confidenceScores: [0.8],
        },
      ]
    );

    const citations = extractCitationsFromResponse(response);

    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe(redirectUri);
  });
});
