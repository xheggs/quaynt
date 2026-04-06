import type { Citation } from '../adapter.types';
import type { DeepSeekChatResponse } from './deepseek.types';

/**
 * Extract citations from a DeepSeek Chat Completions response.
 *
 * Always returns an empty array. DeepSeek's API has no web search,
 * grounding, or citation capability — responses are based purely on
 * training data. Brand visibility analysis for DeepSeek relies on
 * text content processed by the downstream citation classification
 * engine (1.7), not structured citations from the adapter.
 */
export function extractCitationsFromResponse(
  _response: DeepSeekChatResponse // eslint-disable-line @typescript-eslint/no-unused-vars
): Citation[] {
  return [];
}
