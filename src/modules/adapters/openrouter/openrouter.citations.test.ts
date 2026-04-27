// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse } from './openrouter.citations';
import type { OpenRouterChatResponse } from './openrouter.types';

const onlineResp: OpenRouterChatResponse = {
  id: 'gen-1',
  model: 'openai/gpt-4o',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Done.',
        annotations: [
          {
            type: 'url_citation',
            url_citation: { url: 'https://a.example/x', title: 'A', content: 'snippet a' },
          },
          { type: 'url_citation', url_citation: { url: 'https://b.example/y' } },
          { type: 'url_citation', url_citation: { url: 'https://a.example/x' } }, // dup
          { type: 'unrelated', url_citation: { url: 'https://ignored.example' } }, // wrong type
        ],
      },
    },
  ],
};

const sonarResp: OpenRouterChatResponse = {
  id: 'gen-2',
  model: 'perplexity/sonar-pro',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Sonar reply.',
        citations: ['https://x.example/1', 'https://y.example/2', 'https://x.example/1'],
      },
    },
  ],
  citations: ['https://z.example/3'], // top-level too — should be unioned
};

describe('extractCitationsFromResponse', () => {
  it('online style: extracts url_citation annotations, dedupes, ignores other types', () => {
    const out = extractCitationsFromResponse(onlineResp, 'online');

    expect(out.map((c) => c.url)).toEqual(['https://a.example/x', 'https://b.example/y']);
    expect(out[0]?.title).toBe('A');
    expect(out[0]?.snippet).toBe('snippet a');
    expect(out[0]?.position).toBe(1);
    expect(out[1]?.position).toBe(2);
  });

  it('sonar style: combines message.citations + top-level citations, dedupes, position 1-based', () => {
    const out = extractCitationsFromResponse(sonarResp, 'sonar');

    expect(out.map((c) => c.url)).toEqual([
      'https://x.example/1',
      'https://y.example/2',
      'https://z.example/3',
    ]);
    expect(out[0]?.position).toBe(1);
    expect(out[2]?.position).toBe(3);
  });

  it('online style falls back to flat array when no annotations are present', () => {
    const out = extractCitationsFromResponse(sonarResp, 'online');
    expect(out.length).toBeGreaterThan(0);
  });

  it('sonar style falls back to annotations when no flat citations are present', () => {
    const out = extractCitationsFromResponse(onlineResp, 'sonar');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns empty array when response has no citations in either shape', () => {
    const empty: OpenRouterChatResponse = {
      id: 'gen-3',
      model: 'openai/gpt-4o',
      choices: [
        { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'No web.' } },
      ],
    };
    expect(extractCitationsFromResponse(empty, 'online')).toEqual([]);
    expect(extractCitationsFromResponse(empty, 'sonar')).toEqual([]);
  });
});
