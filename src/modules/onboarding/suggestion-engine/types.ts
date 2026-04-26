import type { ZodSchema } from 'zod';

export type EngineProviderId = 'openai' | 'anthropic' | 'openrouter';

export type SuggestionEngineErrorCode =
  | 'engine_unavailable'
  | 'engine_rate_limited'
  | 'engine_response_invalid'
  | 'engine_timeout';

export class SuggestionEngineError extends Error {
  readonly code: SuggestionEngineErrorCode;
  constructor(code: SuggestionEngineErrorCode, message: string) {
    super(message);
    this.name = 'SuggestionEngineError';
    this.code = code;
  }
}

export type SuggestOptions = {
  /** Workspace locale (e.g. `en-US`, `de-DE`). Influences output language. */
  locale?: string;
  /** Soft per-call timeout in ms. Default 20_000. */
  timeoutMs?: number;
};

/**
 * Provider-agnostic interface for the small LLM call that backs onboarding
 * auto-suggestion. Intentionally separate from the AI-visibility adapters in
 * `modules/adapters/` — those measure how engines see the brand and must not
 * also be the source of "what brand is this" suggestions, to avoid closed-loop
 * bias and quota drain.
 */
export interface SuggestionEngine {
  readonly providerId: EngineProviderId;
  suggest<T>(prompt: SuggestionPrompt, schema: ZodSchema<T>, opts?: SuggestOptions): Promise<T>;
}

export type SuggestionPrompt = {
  /** System / role instruction for the model. */
  system: string;
  /** User message body. Plain text, may include extracted brand context. */
  user: string;
  /** Stable name for the JSON schema returned (used by some providers). */
  schemaName: string;
  /** Schema description for the model. */
  schemaDescription: string;
  /**
   * Optional JSON schema in a provider-neutral shape — providers that support
   * structured output may use this directly. Optional because Zod is the
   * source of truth: providers can also fall back to "respond with JSON only"
   * + Zod parsing.
   */
  jsonSchema?: Record<string, unknown>;
};
