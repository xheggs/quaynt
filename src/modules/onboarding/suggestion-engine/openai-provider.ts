import OpenAI from 'openai';
import type { ZodSchema } from 'zod';
import {
  SuggestionEngineError,
  type EngineProviderId,
  type SuggestionEngine,
  type SuggestionPrompt,
  type SuggestOptions,
} from './types';

export type OpenAiSuggestionEngineConfig = {
  apiKey: string;
  /** Default `gpt-4.1-mini`. Set via `SUGGESTION_ENGINE_MODEL`. */
  model?: string;
  baseURL?: string;
  /** When true, do NOT send `response_format` to the upstream — even in
   * the no-jsonSchema fallback case. Useful when routing to providers
   * that reject the field (some non-OpenAI upstreams behind OpenRouter
   * 429 on `json_object`). With this flag, the response is shaped by the
   * prompt + Zod validation only. */
  omitResponseFormat?: boolean;
  /** Extra fields merged into every chat completions request body.
   * Used by the OpenRouter wrapper to pass `models: [...]` for native
   * provider-side fallback routing. Sent verbatim — caller is responsible
   * for compatibility with the chosen `baseURL`. */
  extraBody?: Record<string, unknown>;
};

/**
 * OpenAI implementation of `SuggestionEngine`. Uses the Chat Completions API
 * with `response_format: json_schema` for strict structured output.
 *
 * The Chat Completions surface is chosen over the Responses API for parity
 * with the Anthropic provider's tool-use shape — both are "give me JSON
 * matching this schema" calls, and Chat Completions is the most stable
 * deployment surface across operator-supplied OpenAI-compatible endpoints.
 */
export class OpenAiSuggestionEngine implements SuggestionEngine {
  readonly providerId: EngineProviderId = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly omitResponseFormat: boolean;
  private readonly extraBody: Record<string, unknown> | undefined;

  constructor(config: OpenAiSuggestionEngineConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model ?? 'gpt-4.1-mini';
    this.omitResponseFormat = config.omitResponseFormat ?? false;
    this.extraBody = config.extraBody;
  }

  async suggest<T>(
    prompt: SuggestionPrompt,
    schema: ZodSchema<T>,
    opts: SuggestOptions = {}
  ): Promise<T> {
    const localeNote = opts.locale ? `\nReply in the operator's locale: ${opts.locale}.` : '';
    const ac = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 20_000;
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let raw: unknown;
    try {
      const responseFormat = this.omitResponseFormat
        ? undefined
        : prompt.jsonSchema
          ? ({
              type: 'json_schema' as const,
              json_schema: {
                name: prompt.schemaName,
                description: prompt.schemaDescription,
                schema: prompt.jsonSchema,
                strict: true,
              },
            } as const)
          : ({ type: 'json_object' as const } as const);
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system + localeNote },
            { role: 'user', content: prompt.user },
          ],
          ...(responseFormat ? { response_format: responseFormat } : {}),
          ...(this.extraBody ?? {}),
          temperature: 0.3,
        },
        { signal: ac.signal }
      );
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new SuggestionEngineError(
          'engine_response_invalid',
          'OpenAI returned an empty completion.'
        );
      }
      try {
        raw = JSON.parse(content);
      } catch (e) {
        throw new SuggestionEngineError(
          'engine_response_invalid',
          `OpenAI returned non-JSON content: ${(e as Error).message}`
        );
      }
    } catch (e) {
      if (e instanceof SuggestionEngineError) throw e;
      const err = e as Error & { status?: number; name?: string };
      if (err.name === 'AbortError') {
        throw new SuggestionEngineError('engine_timeout', `OpenAI timed out after ${timeoutMs}ms`);
      }
      if (err.status === 429) {
        throw new SuggestionEngineError('engine_rate_limited', 'OpenAI rate-limited');
      }
      throw new SuggestionEngineError('engine_unavailable', `OpenAI error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new SuggestionEngineError(
        'engine_response_invalid',
        `OpenAI response failed schema validation: ${parsed.error.message}`
      );
    }
    return parsed.data;
  }
}
