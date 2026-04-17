import type {
  ObservedFanoutTree,
  QueryFanoutExtractorInput,
} from '@/modules/query-fanout/query-fanout.types';
import type { OpenAIResponsesResponse } from './chatgpt.types';

/**
 * Extract the observed query-fanout tree from a ChatGPT Responses API response.
 *
 * The Responses API exposes `web_search_call` items whose `action.query` carries
 * the sub-query text. Sources per sub-query are **not** exposed: ChatGPT returns
 * a flat list of URL citations via `output_text.annotations[]`, with no mapping
 * back to the individual search calls. We therefore record sub-query nodes with
 * empty source arrays and flag the limitation via `metadata.sourcesAttached`.
 *
 * Returns `null` when no `web_search_call` items carry an `action.query`.
 */
export function extractQueryFanoutFromChatGPTResponse(
  input: QueryFanoutExtractorInput
): ObservedFanoutTree | null {
  const response = input.rawResponse as OpenAIResponsesResponse | undefined;
  const output = response?.output;
  if (!Array.isArray(output)) return null;

  const subQueries = [];
  const seenQueries = new Set<string>();
  for (const item of output) {
    if (item.type !== 'web_search_call') continue;
    const query = item.action?.query;
    if (typeof query !== 'string' || query.length === 0) continue;
    if (seenQueries.has(query)) continue;
    seenQueries.add(query);
    subQueries.push({ text: query, sources: [] });
  }

  if (subQueries.length === 0) return null;

  return {
    root: { text: input.interpolatedPrompt },
    subQueries,
    rootSources: [],
    metadata: {
      sourcesAttached: false,
      reason: 'chatgpt-flat-annotations',
    },
  };
}
