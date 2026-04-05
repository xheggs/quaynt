// ---------------------------------------------------------------------------
// AIO citation extraction — from normalized SerpSearchResult to Citation[].
// ---------------------------------------------------------------------------

import type { Citation } from '../adapter.types';
import type { SerpSearchResult } from './aio.types';

/**
 * Extract citations from a normalized SERP search result.
 *
 * Iterates AI Overview references in order, deduplicates by URL (first
 * occurrence wins), and maps to flat Citation objects. Brand relevance
 * classification is handled downstream by the citation classification
 * engine (1.7).
 */
export function extractCitationsFromSerpResult(result: SerpSearchResult): Citation[] {
  if (!result.hasAiOverview || !result.aiOverview) return [];

  const references = result.aiOverview.references;
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
      position: position++,
    });
  }

  return citations;
}
