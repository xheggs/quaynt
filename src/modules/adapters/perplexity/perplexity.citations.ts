import type { Citation } from '../adapter.types';
import type { PerplexityChatResponse } from './perplexity.types';

/**
 * Extract all citations from a Perplexity Chat Completions API response.
 *
 * Perplexity returns citations as a flat array of URL strings at
 * `choices[0].message.citations`. Each URL is mapped to a `Citation`
 * with an empty title and snippet — enrichment is deferred to the
 * citation classification engine (1.7).
 *
 * Returns all citations unfiltered — brand relevance classification is
 * handled downstream. Citations are deduplicated by URL; position is
 * 1-based order of first appearance.
 */
export function extractCitationsFromResponse(response: PerplexityChatResponse): Citation[] {
  const urls = response.choices?.[0]?.message?.citations;
  if (!urls || urls.length === 0) return [];

  const seenUrls = new Set<string>();
  const citations: Citation[] = [];
  let position = 1;

  for (const url of urls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    citations.push({
      url,
      title: '',
      snippet: '',
      position: position++,
    });
  }

  return citations;
}
