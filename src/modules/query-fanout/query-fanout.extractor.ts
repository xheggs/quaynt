import { extractQueryFanoutFromGeminiResponse } from '@/modules/adapters/gemini/gemini.query-fanout';
import { extractQueryFanoutFromAioResponse } from '@/modules/adapters/aio/aio.query-fanout';
import { extractQueryFanoutFromChatGPTResponse } from '@/modules/adapters/chatgpt/chatgpt.query-fanout';
import type { ObservedFanoutTree, QueryFanoutExtractorInput } from './query-fanout.types';

/**
 * Dispatch to the correct per-adapter extractor by platform id.
 *
 * Returns `null` for platforms that do not surface observed fan-out data
 * (Perplexity, Claude, Grok, Copilot, DeepSeek, …). Callers treat `null`
 * as "skip, no rows" — not a failure.
 */
export function extractObservedFanout(input: QueryFanoutExtractorInput): ObservedFanoutTree | null {
  switch (input.platformId) {
    case 'gemini':
      return extractQueryFanoutFromGeminiResponse(input);
    case 'aio':
      return extractQueryFanoutFromAioResponse(input);
    case 'chatgpt':
      return extractQueryFanoutFromChatGPTResponse(input);
    default:
      return null;
  }
}
