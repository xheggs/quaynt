import type { Citation } from '../adapter.types';
import type {
  OpenRouterChatResponse,
  OpenRouterCitationStyle,
  OpenRouterUrlCitation,
} from './openrouter.types';

/**
 * Extract citations from an OpenRouter Chat Completions response.
 *
 * OpenRouter exposes upstream provider citations in two shapes depending on
 * the routed model:
 *
 *   - **`online`** (`:online` suffix routes through OpenRouter's web plugin
 *     which uses Exa search): citations arrive as
 *     `choices[0].message.annotations[]` of `type: 'url_citation'` with a
 *     nested `url_citation` object. This is the OpenAI annotation shape.
 *
 *   - **`sonar`** (Perplexity Sonar models proxied via OpenRouter): citations
 *     arrive as a flat URL array, sometimes at `choices[0].message.citations`
 *     and sometimes at the top-level `response.citations`.
 *
 * We default to the explicit style passed in but always fall back to the
 * other shape when the primary is empty — OpenRouter's normalization isn't
 * fully deterministic across model upgrades, and a graceful fallback beats
 * an empty `Citation[]`.
 *
 * Citations are deduplicated by URL; position is 1-based first-appearance.
 */
export function extractCitationsFromResponse(
  response: OpenRouterChatResponse,
  style: OpenRouterCitationStyle
): Citation[] {
  const fromAnnotations = extractFromAnnotations(response);
  const fromFlat = extractFromFlatArray(response);

  const primary = style === 'online' ? fromAnnotations : fromFlat;
  if (primary.length > 0) return primary;

  // Fallback to the other shape — OR's normalization is not always strict.
  return style === 'online' ? fromFlat : fromAnnotations;
}

function extractFromAnnotations(response: OpenRouterChatResponse): Citation[] {
  const annotations = response.choices?.[0]?.message?.annotations;
  if (!annotations || annotations.length === 0) return [];

  const seen = new Set<string>();
  const out: Citation[] = [];
  let position = 1;

  for (const a of annotations) {
    if (a.type !== 'url_citation') continue;
    const c: OpenRouterUrlCitation | undefined = a.url_citation;
    if (!c?.url) continue;
    if (seen.has(c.url)) continue;
    seen.add(c.url);

    out.push({
      url: c.url,
      title: c.title ?? '',
      snippet: c.content ?? '',
      position: position++,
    });
  }

  return out;
}

function extractFromFlatArray(response: OpenRouterChatResponse): Citation[] {
  const candidates: string[] = [];
  const messageCitations = response.choices?.[0]?.message?.citations;
  if (Array.isArray(messageCitations)) candidates.push(...messageCitations);
  if (Array.isArray(response.citations)) candidates.push(...response.citations);

  if (candidates.length === 0) return [];

  const seen = new Set<string>();
  const out: Citation[] = [];
  let position = 1;

  for (const url of candidates) {
    if (typeof url !== 'string' || !url) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    out.push({ url, title: '', snippet: '', position: position++ });
  }

  return out;
}
