import type { ZodSchema } from 'zod';
import { OpenAiSuggestionEngine, type OpenAiSuggestionEngineConfig } from './openai-provider';
import type { EngineProviderId, SuggestionEngine, SuggestionPrompt, SuggestOptions } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type OpenRouterSuggestionEngineConfig = Omit<
  OpenAiSuggestionEngineConfig,
  'model' | 'extraBody'
> & {
  /** Required. A single OpenRouter model slug, or an ordered list. With a
   * list, OpenRouter routes to the first available model and falls through
   * automatically when one is rate-limited / unavailable / errors — the
   * `models` field in the request body. We refuse to default this: model
   * availability and pricing on OpenRouter shifts, and silently picking a
   * model on the operator's behalf hides cost decisions. */
  model: string | string[];
  /** Send OpenAI's strict `json_schema` response format. Default `false`
   * for cross-model compatibility; set `true` only when routing to models
   * that natively support it (OpenAI 4o-family, recent Anthropic). */
  strictJsonSchema?: boolean;
};

/**
 * OpenRouter implementation. OpenRouter exposes an OpenAI-compatible Chat
 * Completions API, so this delegates to `OpenAiSuggestionEngine` with the
 * OpenRouter `baseURL`. Identity (`providerId`) and config surface differ;
 * the wire protocol does not.
 *
 * Strict JSON-schema response format is **stripped** by default before
 * delegating, because OpenRouter's catalog includes many models (Gemma,
 * Llama, Mistral, etc.) that don't accept OpenAI's strict `json_schema`
 * mode and would otherwise hard-fail. The downstream `OpenAiSuggestionEngine`
 * then uses `{ type: 'json_object' }` + Zod validation, which is the source
 * of truth in either mode. Operators routing only to strict-capable models
 * (OpenAI, recent Anthropic) can re-enable strict mode by passing
 * `strictJsonSchema: true` at construction.
 *
 * For multi-model fallback, use OpenRouter's native `models: [...]` request
 * field rather than building an app-level chain — OpenRouter has health
 * signals and routing logic we can't replicate cheaply.
 */
export class OpenRouterSuggestionEngine implements SuggestionEngine {
  readonly providerId: EngineProviderId = 'openrouter';
  private readonly inner: OpenAiSuggestionEngine;
  private readonly strictJsonSchema: boolean;

  constructor(config: OpenRouterSuggestionEngineConfig) {
    const strict = config.strictJsonSchema ?? false;
    const list = Array.isArray(config.model) ? config.model : [config.model];
    if (list.length === 0 || !list[0]) {
      throw new Error('OpenRouterSuggestionEngine: model list must be non-empty');
    }
    this.inner = new OpenAiSuggestionEngine({
      apiKey: config.apiKey,
      model: list[0],
      baseURL: config.baseURL ?? OPENROUTER_BASE_URL,
      // Loose mode also drops `response_format` because some upstreams
      // (e.g. Google AI Studio for Gemma) 429 on `json_object` mode.
      // Strict mode keeps the strict json_schema response_format intact.
      omitResponseFormat: !strict,
      // OpenRouter's native multi-model fallback: routing layer tries
      // each in order, falling through on rate-limit / unavailable / error.
      // See https://openrouter.ai/docs/features/model-routing
      extraBody: list.length > 1 ? { models: list } : undefined,
    });
    this.strictJsonSchema = strict;
  }

  suggest<T>(prompt: SuggestionPrompt, schema: ZodSchema<T>, opts?: SuggestOptions): Promise<T> {
    const safe: SuggestionPrompt = this.strictJsonSchema
      ? prompt
      : { ...prompt, jsonSchema: undefined };
    return this.inner.suggest(safe, schema, opts);
  }
}
