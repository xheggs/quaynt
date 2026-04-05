import type { Citation } from '../adapter.types';
import type { GeminiGenerateContentResponse, GeminiGroundingSupport } from './gemini.types';

/**
 * Extract citations from a Gemini generateContent response.
 *
 * Uses a chunk-centric approach (PRP D1): iterates groundingChunks directly,
 * then for each chunk collects all groundingSupports that reference it via
 * groundingChunkIndices. Support segment texts are joined as the snippet.
 *
 * Returns all citations unfiltered — brand relevance classification is
 * handled downstream by the citation classification engine (1.7).
 * Citations are deduplicated by URL; position is 1-based order of first appearance.
 */
export function extractCitationsFromResponse(response: GeminiGenerateContentResponse): Citation[] {
  const candidate = response.candidates?.[0];
  if (!candidate?.groundingMetadata) return [];

  const { groundingChunks, groundingSupports } = candidate.groundingMetadata;
  if (!groundingChunks || groundingChunks.length === 0) return [];

  const supports = groundingSupports ?? [];
  const seenUrls = new Map<string, Citation>();
  const citations: Citation[] = [];
  let position = 1;

  for (let i = 0; i < groundingChunks.length; i++) {
    const chunk = groundingChunks[i];
    if (!chunk.web?.uri) continue;

    const url = chunk.web.uri;

    // Defensive dedup: if same URI appeared in an earlier chunk, append snippet
    const existing = seenUrls.get(url);
    if (existing) {
      const additionalSnippet = collectSnippetForChunk(i, supports);
      if (additionalSnippet) {
        existing.snippet = existing.snippet
          ? `${existing.snippet} ${additionalSnippet}`
          : additionalSnippet;
      }
      continue;
    }

    const snippet = collectSnippetForChunk(i, supports);

    const citation: Citation = {
      url,
      title: chunk.web.title ?? '',
      snippet,
      position: position++,
    };

    seenUrls.set(url, citation);
    citations.push(citation);
  }

  return citations;
}

/**
 * Collect snippet text for a given chunk index by joining all supports
 * that reference it via groundingChunkIndices.
 */
function collectSnippetForChunk(chunkIndex: number, supports: GeminiGroundingSupport[]): string {
  const parts: string[] = [];

  for (const support of supports) {
    if (!support.groundingChunkIndices?.includes(chunkIndex)) continue;
    if (support.segment?.text) {
      parts.push(support.segment.text);
    }
  }

  return parts.join(' ');
}
