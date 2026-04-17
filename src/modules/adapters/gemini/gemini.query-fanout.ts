import type {
  ObservedFanoutTree,
  ObservedFanoutSource,
  QueryFanoutExtractorInput,
} from '@/modules/query-fanout/query-fanout.types';
import type { GeminiGenerateContentResponse } from './gemini.types';

/**
 * Extract the observed query-fanout tree from a Gemini generateContent response.
 *
 * Gemini exposes:
 *   - `webSearchQueries[]` — the sub-queries the API actually ran
 *   - `groundingChunks[].web.{uri,title}` — the sources that grounded the response
 *   - `groundingSupports[]` — response-segment → chunk mappings (not sub-query → chunk)
 *
 * Gemini does not expose a clean "this source came from this sub-query" mapping,
 * so all grounding sources attach to the root node as `rootSources` and each
 * sub-query is stored with an empty `sources` array. The `metadata.groundingAttribution`
 * flag signals this to the UI so it can render an explanatory note.
 */
export function extractQueryFanoutFromGeminiResponse(
  input: QueryFanoutExtractorInput
): ObservedFanoutTree | null {
  const response = input.rawResponse as GeminiGenerateContentResponse | undefined;
  const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
  if (!groundingMetadata) return null;

  const webSearchQueries = groundingMetadata.webSearchQueries ?? [];
  const groundingChunks = groundingMetadata.groundingChunks ?? [];

  if (webSearchQueries.length === 0 && groundingChunks.length === 0) return null;

  const seenUrls = new Set<string>();
  const rootSources: ObservedFanoutSource[] = [];
  for (const chunk of groundingChunks) {
    const url = chunk.web?.uri;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    rootSources.push({ url, title: chunk.web?.title });
  }

  return {
    root: { text: input.interpolatedPrompt },
    subQueries: webSearchQueries.map((text) => ({ text, sources: [] })),
    rootSources,
    metadata: {
      groundingAttribution: 'root-only',
      chunkCount: groundingChunks.length,
    },
  };
}
