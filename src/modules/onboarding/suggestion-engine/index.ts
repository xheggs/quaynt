import { AnthropicSuggestionEngine } from './anthropic-provider';
import { OpenAiSuggestionEngine } from './openai-provider';
import { OpenRouterSuggestionEngine } from './openrouter-provider';
import type { SuggestionEngine } from './types';

export type { SuggestionEngine, SuggestionEngineErrorCode, EngineProviderId } from './types';
export { SuggestionEngineError } from './types';

/**
 * Resolve the configured `SuggestionEngine`, or `null` when none is available.
 *
 * Returning `null` is the expected OSS path: self-hosted operators who do not
 * configure a provider get the existing 5.14 manual onboarding flow with the
 * dedicated `noEngine` UI copy. Callers MUST handle null.
 *
 * Branches:
 *   1. `ONBOARDING_SUGGEST_DISABLED=true`              → null (operator opt-out).
 *   2. `SUGGESTION_ENGINE_PROVIDER` unset / unknown    → null.
 *   3. `openrouter` without `SUGGESTION_ENGINE_MODEL`  → null (model is required;
 *      OpenRouter slugs change too quickly to default safely).
 *   4. Provider configured + key (+ model for openrouter) present → instance.
 *
 * `SUGGESTION_ENGINE_MODEL` accepts a comma-separated list. For `openrouter`,
 * the full list is forwarded as the request body's `models[]` field so the
 * routing layer can fall through automatically when an entry is rate-limited
 * or unavailable. `openai` / `anthropic` ignore extra entries — their SDKs
 * only accept a single model — and use the first slug.
 */
export function getSuggestionEngine(env: NodeJS.ProcessEnv = process.env): SuggestionEngine | null {
  if (env.ONBOARDING_SUGGEST_DISABLED === 'true') return null;
  const provider = (env.SUGGESTION_ENGINE_PROVIDER ?? '').toLowerCase().trim();
  const apiKey = env.SUGGESTION_ENGINE_API_KEY ?? '';
  const models = parseModelList(env.SUGGESTION_ENGINE_MODEL);
  const baseURL = env.SUGGESTION_ENGINE_BASE_URL || undefined;
  if (!provider || !apiKey) return null;
  if (provider === 'openai') {
    return new OpenAiSuggestionEngine({ apiKey, model: models[0], baseURL });
  }
  if (provider === 'anthropic') {
    return new AnthropicSuggestionEngine({ apiKey, model: models[0], baseURL });
  }
  if (provider === 'openrouter') {
    if (models.length === 0) return null;
    const strictJsonSchema = env.SUGGESTION_ENGINE_STRICT_JSON_SCHEMA === 'true';
    return new OpenRouterSuggestionEngine({
      apiKey,
      model: models.length === 1 ? models[0]! : models,
      baseURL,
      strictJsonSchema,
    });
  }
  return null;
}

/** Split SUGGESTION_ENGINE_MODEL on `,`, trim, drop empties, dedupe. */
function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
