import type {
  ObservedFanoutTree,
  ObservedFanoutSubQuery,
  QueryFanoutExtractorInput,
} from '@/modules/query-fanout/query-fanout.types';
import type { SerpSearchResult } from './aio.types';

const SUB_QUERY_LABEL_MAX = 120;

/**
 * Extract the observed query-fanout tree from an AIO (AI Overview) SERP response.
 *
 * AIO does not expose a `webSearchQueries` array; the closest analog is
 * `textBlocks`, the rendered sections of the overview. Each block becomes a
 * sub-query node (label truncated to ~120 chars, full text in metadata) and the
 * sources feeding that block are resolved from `references[]` via `referenceIndexes`.
 *
 * Returns `null` when no overview is present or when the overview has no
 * text blocks.
 */
export function extractQueryFanoutFromAioResponse(
  input: QueryFanoutExtractorInput
): ObservedFanoutTree | null {
  const response = input.rawResponse as SerpSearchResult | undefined;
  const overview = response?.aiOverview;
  if (!overview || !overview.textBlocks || overview.textBlocks.length === 0) return null;

  const referencesByIndex = new Map<number, { url: string; title?: string }>();
  for (const ref of overview.references ?? []) {
    if (ref.link) referencesByIndex.set(ref.index, { url: ref.link, title: ref.title });
  }

  const subQueries: ObservedFanoutSubQuery[] = [];
  for (const block of overview.textBlocks) {
    if (!block.referenceIndexes || block.referenceIndexes.length === 0) continue;

    const sources = [];
    const seenUrls = new Set<string>();
    for (const idx of block.referenceIndexes) {
      const ref = referencesByIndex.get(idx);
      if (!ref || seenUrls.has(ref.url)) continue;
      seenUrls.add(ref.url);
      sources.push(ref);
    }

    const fullText = block.text ?? '';
    const label = truncate(fullText, SUB_QUERY_LABEL_MAX);
    subQueries.push({
      text: label,
      sources,
      metadata: { blockType: block.type, fullText },
    });
  }

  if (subQueries.length === 0) return null;

  return {
    root: { text: input.interpolatedPrompt },
    subQueries,
    rootSources: [],
    metadata: { groundingAttribution: 'per-block' },
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
