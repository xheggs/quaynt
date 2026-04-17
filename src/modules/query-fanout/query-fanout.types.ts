/**
 * Shared types for the query-fanout module.
 *
 * The module captures two kinds of fan-out:
 * - Observed (PRP 6.3a) — decomposition tree (root prompt → sub-queries →
 *   sources) surfaced by platform adapters (Gemini, AIO, ChatGPT).
 * - Simulated (PRP 6.3b) — Qforia-style LLM-generated sub-queries for
 *   platforms that don't expose native decomposition. Carries `intentType` and
 *   provider/model attribution; never has attached sources.
 */

export type FanoutNodeKind = 'root' | 'sub_query' | 'source';

/** Origin of a fan-out node. Observed rows come from platform responses; simulated rows are LLM-generated. */
export type FanoutNodeSource = 'observed' | 'simulated';

/** Minimal input shape the per-adapter extractors need. */
export interface QueryFanoutExtractorInput {
  id: string;
  platformId: string;
  interpolatedPrompt: string;
  rawResponse: unknown;
}

/** Source reference emitted by per-adapter extractors. */
export interface ObservedFanoutSource {
  url: string;
  title?: string;
}

/** A single sub-query with its optional per-sub-query sources. */
export interface ObservedFanoutSubQuery {
  text: string;
  sources: ObservedFanoutSource[];
  /** Per-adapter extras (e.g., AIO textBlock type). */
  metadata?: Record<string, unknown>;
}

/**
 * Normalised fan-out tree returned by every adapter extractor.
 *
 * Adapters that cannot map sources to individual sub-queries (Gemini) return
 * sub-queries with empty `sources` arrays and surface all grounding sources
 * on `rootSources`. Adapters that expose no source attribution at all
 * (ChatGPT) return sub-queries with empty `sources` and empty `rootSources`.
 */
export interface ObservedFanoutTree {
  root: { text: string };
  subQueries: ObservedFanoutSubQuery[];
  rootSources: ObservedFanoutSource[];
  /** Per-adapter metadata for the root node (e.g., attribution style). */
  metadata?: Record<string, unknown>;
}

/** A row as it is written to `query_fanout_node`. */
export interface QueryFanoutNodeRow {
  id: string;
  workspaceId: string;
  /** Null for orchestration-free simulated rows. */
  modelRunId: string | null;
  /** Null for orchestration-free simulated rows. */
  modelRunResultId: string | null;
  /** Null for orchestration-free simulated rows. */
  platformId: string | null;
  promptId: string;
  parentNodeId: string | null;
  kind: FanoutNodeKind;
  source: FanoutNodeSource;
  /** Qforia-style intent tag; populated for simulated sub-queries, null otherwise. */
  intentType: string | null;
  /** Provider used to generate a simulated row; null for observed. */
  simulationProvider: string | null;
  /** Model id used to generate a simulated row; null for observed. */
  simulationModel: string | null;
  subQueryText: string | null;
  sourceUrl: string | null;
  normalizedUrl: string | null;
  sourceTitle: string | null;
  citationId: string | null;
  metadata: Record<string, unknown> | null;
}

/** Source node as rendered in the API response. */
export interface QueryFanoutSourceResponse {
  id: string;
  url: string;
  title: string | null;
  citationId: string | null;
}

/**
 * Sub-query node as rendered in the API response.
 *
 * Simulated sub-queries carry `isSimulated: true`, an `intentType` tag, and
 * provider/model attribution. Observed sub-queries carry `isSimulated: false`
 * and null simulation fields. Response order reflects DB order (created_at).
 */
export interface QueryFanoutSubQueryResponse {
  id: string;
  text: string;
  metadata: Record<string, unknown> | null;
  sources: QueryFanoutSourceResponse[];
  isSimulated: boolean;
  intentType: string | null;
  simulationProvider: string | null;
  simulationModel: string | null;
}

/** One tree per model-run-result, matching the panel's render shape. */
export interface QueryFanoutTreeResponse {
  modelRunResultId: string;
  platformId: string;
  promptId: string;
  promptText: string;
  rootMetadata: Record<string, unknown> | null;
  subQueries: QueryFanoutSubQueryResponse[];
  rootSources: QueryFanoutSourceResponse[];
}
