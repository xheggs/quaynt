import type { Citation } from '../adapter.types';
import type { ClaudeMessagesResponse, ClaudeWebSearchError } from './claude.types';

/**
 * Extract all citations from an Anthropic Messages API response.
 *
 * Returns all citations unfiltered — brand relevance classification is
 * handled downstream by the citation classification engine (1.7).
 * Citations are deduplicated by URL; position is 1-based order of first appearance.
 */
export function extractCitationsFromResponse(response: ClaudeMessagesResponse): Citation[] {
  const seenUrls = new Set<string>();
  const citations: Citation[] = [];
  let position = 1;

  for (const block of response.content) {
    if (block.type !== 'text' || !block.citations) continue;

    for (const citation of block.citations) {
      if (citation.type !== 'web_search_result_location') continue;

      if (seenUrls.has(citation.url)) continue;
      seenUrls.add(citation.url);

      citations.push({
        url: citation.url,
        title: citation.title ?? '',
        snippet: citation.cited_text ?? '',
        position: position++,
      });
    }
  }

  return citations;
}

/**
 * Extract web search error codes from a Claude response.
 *
 * Web search failures arrive as `web_search_tool_result_error` content blocks
 * inside otherwise successful (HTTP 200) responses. Returns an array of
 * error_code strings (empty if no errors).
 */
export function extractWebSearchErrors(response: ClaudeMessagesResponse): string[] {
  const errors: string[] = [];

  for (const block of response.content) {
    if (block.type !== 'web_search_tool_result') continue;

    const content = block.content;

    // Error content is a single object, not an array
    if (!Array.isArray(content) && content.type === 'web_search_tool_result_error') {
      errors.push((content as ClaudeWebSearchError).error_code);
    }
  }

  return errors;
}
