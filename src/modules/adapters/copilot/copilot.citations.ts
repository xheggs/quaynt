// ---------------------------------------------------------------------------
// Copilot citation extraction — from CopilotSearchResult to Citation[].
// ---------------------------------------------------------------------------

import type { Citation } from '../adapter.types';
import type { CopilotSearchResult } from './copilot.types';

/**
 * Extract citations from a normalized Copilot search result.
 *
 * Iterates Copilot answer references in order, deduplicates by URL (first
 * occurrence wins), and maps to flat Citation objects. Brand relevance
 * classification is handled downstream by the citation classification
 * engine (1.7).
 */
export function extractCitationsFromCopilotResult(result: CopilotSearchResult): Citation[] {
  if (!result.hasCopilotAnswer || !result.copilotAnswer) return [];

  const references = result.copilotAnswer.references;
  if (!references || references.length === 0) return [];

  const seenUrls = new Set<string>();
  const citations: Citation[] = [];
  let position = 1;

  for (const ref of references) {
    if (!ref.link) continue;

    if (seenUrls.has(ref.link)) continue;
    seenUrls.add(ref.link);

    citations.push({
      url: ref.link,
      title: ref.title ?? '',
      snippet: ref.snippet ?? '',
      position: ref.index > 0 ? ref.index : position,
    });

    position++;
  }

  return citations;
}
