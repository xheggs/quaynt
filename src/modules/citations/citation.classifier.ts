import type { Citation } from '@/modules/adapters/adapter.types';
import type { RelevanceSignal } from './citation.types';
import { brandMentionedInText } from './brand-match';

/**
 * Classify a citation as "owned" or "earned" based on whether the prompt
 * explicitly queried the brand.
 *
 * - **owned**: the interpolated prompt mentions the brand by name or alias
 * - **earned**: the brand appeared in the response without being queried
 */
export function classifyCitationType(
  interpolatedPrompt: string,
  brand: { name: string; aliases: string[] }
): 'owned' | 'earned' {
  return brandMentionedInText(interpolatedPrompt, brand) ? 'owned' : 'earned';
}

/**
 * Filter citations to those relevant to the brand, returning the most specific
 * relevance signal that matched.
 *
 * Specificity order (most to least):
 * 1. domain_match — citation URL hostname matches brand.domain
 * 2. title_match — brand mentioned in citation title
 * 3. snippet_match — brand mentioned in citation snippet
 * 4. response_mention — brand mentioned anywhere in the full response text
 *
 * Returns the first (most specific) signal that fires for each citation.
 */
export function filterBrandRelevantCitations(
  citations: Citation[],
  textContent: string,
  brand: { name: string; aliases: string[]; domain: string | null }
): { citation: Citation; relevanceSignal: RelevanceSignal }[] {
  const brandInResponse = brandMentionedInText(textContent, brand);
  const results: { citation: Citation; relevanceSignal: RelevanceSignal }[] = [];

  for (const cit of citations) {
    const signal = getRelevanceSignal(cit, textContent, brand, brandInResponse);
    if (signal) {
      results.push({ citation: cit, relevanceSignal: signal });
    }
  }

  return results;
}

function getRelevanceSignal(
  cit: Citation,
  _textContent: string,
  brand: { name: string; aliases: string[]; domain: string | null },
  brandInResponse: boolean
): RelevanceSignal | null {
  // 1. Domain match (most specific)
  if (brand.domain && matchesDomain(cit.url, brand.domain)) {
    return 'domain_match';
  }

  // 2. Title match
  if (cit.title && brandMentionedInText(cit.title, brand)) {
    return 'title_match';
  }

  // 3. Snippet match
  if (cit.snippet && brandMentionedInText(cit.snippet, brand)) {
    return 'snippet_match';
  }

  // 4. Response mention (broadest signal)
  if (brandInResponse) {
    return 'response_mention';
  }

  return null;
}

function matchesDomain(url: string, brandDomain: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const domain = brandDomain.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}
