/**
 * Types for the Qforia-style simulated query fan-out.
 *
 * Observed fan-out (PRP 6.3a) is what the platform's provider emits in the raw
 * response (Gemini's webSearchQueries, AIO's textBlocks, …). Simulated fan-out
 * is what an LLM (OpenAI / Anthropic / Gemini) produces when asked to enumerate
 * the sub-queries a retrieval system *would* generate — used to fill the gap
 * for platforms that don't expose native decomposition (Perplexity, Claude,
 * Copilot, Grok, …).
 */

/** v1 intent taxonomy (mirrors Qforia). Names and casing are frozen in the DB CHECK constraint. */
export type SimulationIntent =
  | 'related'
  | 'implicit'
  | 'comparative'
  | 'reformulation'
  | 'entity_expansion'
  | 'recent'
  | 'personalised'
  | 'other';

export const SIMULATION_INTENTS: readonly SimulationIntent[] = [
  'related',
  'implicit',
  'comparative',
  'reformulation',
  'entity_expansion',
  'recent',
  'personalised',
  'other',
] as const;

/** Which upstream provider we use to generate the simulation. */
export type SimulationProvider = 'openai' | 'anthropic' | 'gemini';

export const SIMULATION_PROVIDERS: readonly SimulationProvider[] = [
  'openai',
  'anthropic',
  'gemini',
] as const;

/** A single inferred sub-query the simulator produces. */
export interface SimulatedSubQuery {
  text: string;
  intentType: SimulationIntent;
  /** 0.0–1.0 — how central the model thinks this sub-query is to the prompt. */
  priority: number;
  /** Optional one-line rationale the model emits alongside the sub-query. */
  reasoning?: string;
}

/** Caller options for a simulation. */
export interface SimulationOptions {
  provider?: SimulationProvider;
  /** Override the provider's default model (e.g., `gpt-4o`, `gemini-2.5-pro`). */
  modelOverride?: string;
  /** Hint for the model — approximate number of sub-queries to produce. Default 12. */
  subQueryTarget?: number;
  /** Sampling temperature. Defaults to 0 for determinism. */
  temperature?: number;
}

/** What the simulator service returns to callers. */
export interface SimulationResult {
  subQueries: SimulatedSubQuery[];
  provider: SimulationProvider;
  modelId: string;
  modelVersion: string | null;
  cacheHit: boolean;
  elapsedMs: number;
  /** Populated when the provider reports usage; null when unknown. */
  usage?: SimulationUsage | null;
}

export interface SimulationUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

// -- Typed errors -----------------------------------------------------------

/**
 * Base error class for simulator failures. Callers distinguish on `.code` to
 * route specific reasons through to API `meta.reason` values.
 */
export class SimulationError extends Error {
  constructor(
    message: string,
    public readonly code: SimulationErrorCode,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SimulationError';
  }
}

export type SimulationErrorCode =
  | 'no_simulation_provider_configured'
  | 'simulation_parse_failed'
  | 'simulation_rate_limited'
  | 'simulation_timeout'
  | 'simulation_failed';

export class SimulationNoProviderError extends SimulationError {
  constructor(message = 'No simulation provider adapter is configured for this workspace') {
    super(message, 'no_simulation_provider_configured');
    this.name = 'SimulationNoProviderError';
  }
}

export class SimulationParseError extends SimulationError {
  constructor(message = 'Simulator output failed schema validation', cause?: unknown) {
    super(message, 'simulation_parse_failed', cause);
    this.name = 'SimulationParseError';
  }
}

export class SimulationTimeoutError extends SimulationError {
  constructor(message = 'Simulation provider call exceeded timeout', cause?: unknown) {
    super(message, 'simulation_timeout', cause);
    this.name = 'SimulationTimeoutError';
  }
}

export class SimulationRateLimitError extends SimulationError {
  constructor(
    message: string,
    public readonly retryAfterMs: number | null,
    cause?: unknown
  ) {
    super(message, 'simulation_rate_limited', cause);
    this.name = 'SimulationRateLimitError';
  }
}
