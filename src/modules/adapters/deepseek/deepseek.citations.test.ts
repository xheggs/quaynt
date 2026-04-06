// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractCitationsFromResponse } from './deepseek.citations';
import type { DeepSeekChatResponse } from './deepseek.types';

const sampleResponse: DeepSeekChatResponse = {
  id: 'chatcmpl-deepseek-abc',
  object: 'chat.completion',
  model: 'deepseek-chat',
  created: 1700000000,
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'Acme Corp is a well-known company in the widget industry.',
      },
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
};

describe('extractCitationsFromResponse', () => {
  it('returns empty array for a standard response', () => {
    const citations = extractCitationsFromResponse(sampleResponse);
    expect(citations).toEqual([]);
  });

  it('returns empty array regardless of response content', () => {
    const responseWithUrls: DeepSeekChatResponse = {
      ...sampleResponse,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Check out https://example.com and https://another.com for more information.',
          },
        },
      ],
    };

    const citations = extractCitationsFromResponse(responseWithUrls);
    expect(citations).toEqual([]);
  });

  it('returns empty array for response with reasoning_content', () => {
    const responseWithReasoning: DeepSeekChatResponse = {
      ...sampleResponse,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Final answer here.',
            reasoning_content: 'Let me think about this step by step...',
          },
        },
      ],
    };

    const citations = extractCitationsFromResponse(responseWithReasoning);
    expect(citations).toEqual([]);
  });
});
