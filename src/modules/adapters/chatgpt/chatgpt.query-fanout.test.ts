// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractQueryFanoutFromChatGPTResponse } from './chatgpt.query-fanout';
import type { OpenAIResponsesResponse } from './chatgpt.types';

function makeInput(rawResponse: unknown) {
  return {
    id: 'runres_test',
    platformId: 'chatgpt',
    interpolatedPrompt: 'Best project management tools?',
    rawResponse,
  };
}

describe('extractQueryFanoutFromChatGPTResponse', () => {
  it('extracts sub-queries from web_search_call items with action.query', () => {
    const response: OpenAIResponsesResponse = {
      id: 'resp_test',
      model: 'gpt-4o-mini',
      output: [
        {
          type: 'web_search_call',
          id: 'ws_1',
          status: 'completed',
          action: { type: 'search', query: 'best project management tools 2026' },
        },
        {
          type: 'web_search_call',
          id: 'ws_2',
          status: 'completed',
          action: { type: 'search', query: 'team collaboration software' },
        },
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'Asana is a popular choice.',
              annotations: [],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    };

    const tree = extractQueryFanoutFromChatGPTResponse(makeInput(response));

    expect(tree).not.toBeNull();
    expect(tree!.subQueries).toHaveLength(2);
    expect(tree!.subQueries[0]).toEqual({
      text: 'best project management tools 2026',
      sources: [],
    });
    expect(tree!.rootSources).toEqual([]);
    expect(tree!.metadata).toEqual({
      sourcesAttached: false,
      reason: 'chatgpt-flat-annotations',
    });
  });

  it('dedupes repeated query strings', () => {
    const response: OpenAIResponsesResponse = {
      id: 'resp_test',
      model: 'gpt-4o-mini',
      output: [
        {
          type: 'web_search_call',
          id: 'ws_1',
          status: 'completed',
          action: { type: 'search', query: 'same query' },
        },
        {
          type: 'web_search_call',
          id: 'ws_2',
          status: 'completed',
          action: { type: 'search', query: 'same query' },
        },
      ],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
    const tree = extractQueryFanoutFromChatGPTResponse(makeInput(response));
    expect(tree!.subQueries).toHaveLength(1);
  });

  it('returns null when no web_search_call items have action.query', () => {
    const response: OpenAIResponsesResponse = {
      id: 'resp_msg_only',
      model: 'gpt-4o-mini',
      output: [
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'No search here.', annotations: [] }],
        },
      ],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
    expect(extractQueryFanoutFromChatGPTResponse(makeInput(response))).toBeNull();
  });

  it('returns null when web_search_call items have no action field', () => {
    const response: OpenAIResponsesResponse = {
      id: 'resp_no_action',
      model: 'gpt-4o-mini',
      output: [{ type: 'web_search_call', id: 'ws_1', status: 'completed' }],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
    expect(extractQueryFanoutFromChatGPTResponse(makeInput(response))).toBeNull();
  });

  it('returns null when output is missing', () => {
    expect(extractQueryFanoutFromChatGPTResponse(makeInput({}))).toBeNull();
    expect(extractQueryFanoutFromChatGPTResponse(makeInput(undefined))).toBeNull();
  });
});
