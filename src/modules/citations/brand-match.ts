/**
 * Brand mention detection utilities.
 *
 * Relocated from adapters/chatgpt/chatgpt.citations.ts to be shared across
 * the citation extraction pipeline and any adapter that needs brand matching.
 */

/**
 * Escape special regex characters in a string so it can be used as a
 * literal pattern inside a RegExp constructor.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether the given text mentions a brand by name or any of its aliases.
 *
 * Uses word-boundary matching to avoid false positives (e.g., "Go" won't match "Google").
 *
 * Known limitation: `\b` word boundaries are Latin-script oriented. CJK scripts
 * and some compound-word languages may need Unicode-aware segmentation in a future iteration.
 */
export function brandMentionedInText(
  text: string,
  brand: { name: string; aliases: string[] }
): boolean {
  if (!text) return false;

  const terms = [brand.name, ...brand.aliases];
  return terms.some((term) => {
    const escaped = escapeRegex(term);
    return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'i').test(text);
  });
}
