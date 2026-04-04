import type { Citation } from '../adapter.types';
import type {
  OpenAIMessageItem,
  OpenAIResponsesResponse,
  OpenAIUrlCitation,
} from './chatgpt.types';

// Re-export from shared location for backward compatibility
export { brandMentionedInText } from '@/modules/citations/brand-match';

/**
 * Extract all citations from an OpenAI Responses API response.
 *
 * Returns all citations unfiltered — brand relevance classification is
 * handled downstream by the citation classification engine (1.7).
 * Citations are deduplicated by URL; position is 1-based order of first appearance.
 */
export function extractCitationsFromResponse(response: OpenAIResponsesResponse): Citation[] {
  const seenUrls = new Set<string>();
  const citations: Citation[] = [];
  let position = 1;

  for (const item of response.output) {
    if (item.type !== 'message') continue;
    const messageItem = item as OpenAIMessageItem;

    for (const part of messageItem.content) {
      if (part.type !== 'output_text' || !part.annotations) continue;

      for (const annotation of part.annotations) {
        if (annotation.type !== 'url_citation') continue;
        const cite = annotation as OpenAIUrlCitation;

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

  return citations;
}
