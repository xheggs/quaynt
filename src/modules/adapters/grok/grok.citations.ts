import type { Citation } from '../adapter.types';
import type { GrokMessageItem, GrokResponsesResponse, GrokUrlCitation } from './grok.types';

// Re-export from shared location for backward compatibility
export { brandMentionedInText } from '@/modules/citations/brand-match';

/**
 * Extract all citations from a Grok Responses API response.
 *
 * Phase 1: Extract from annotation-level `url_citation` objects (positional, in-text).
 * Phase 2: Supplement with unique URLs from the top-level `citations` array.
 *
 * Returns all citations unfiltered — brand relevance classification is
 * handled downstream by the citation classification engine (1.7).
 * Citations are deduplicated by URL; position is 1-based order of first appearance.
 */
export function extractCitationsFromResponse(response: GrokResponsesResponse): Citation[] {
  const seenUrls = new Set<string>();
  const citations: Citation[] = [];
  let position = 1;

  // Phase 1 — Annotation citations (same structure as OpenAI url_citation)
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    const messageItem = item as GrokMessageItem;

    for (const part of messageItem.content) {
      if (part.type !== 'output_text' || !part.annotations) continue;

      for (const annotation of part.annotations) {
        if (annotation.type !== 'url_citation') continue;
        const cite = annotation as GrokUrlCitation;

        if (seenUrls.has(cite.url)) continue;
        seenUrls.add(cite.url);

        const snippet =
          cite.start_index >= 0 && cite.end_index > cite.start_index
            ? part.text.substring(cite.start_index, cite.end_index)
            : '';

        citations.push({
          url: cite.url,
          title: cite.title,
          snippet,
          position: position++,
        });
      }
    }
  }

  // Phase 2 — Top-level citations (xAI-specific extension)
  if (response.citations) {
    for (const topCite of response.citations) {
      if (seenUrls.has(topCite.url)) continue;
      seenUrls.add(topCite.url);

      citations.push({
        url: topCite.url,
        title: topCite.title ?? '',
        snippet: topCite.snippet ?? '',
        position: position++,
      });
    }
  }

  return citations;
}

/**
 * Build a URL-to-source mapping from the top-level `citations` array.
 *
 * Returns a map of URL → source type (`'web'` or `'x'`).
 * Downstream consumers (e.g., 1.7 citation classification) can use this
 * to distinguish web citations from X/Twitter citations.
 */
export function getCitationSources(response: GrokResponsesResponse): Map<string, 'web' | 'x'> {
  const sources = new Map<string, 'web' | 'x'>();

  if (!response.citations) return sources;

  for (const cite of response.citations) {
    sources.set(cite.url, cite.source);
  }

  return sources;
}
