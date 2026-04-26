import Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';
import {
  SuggestionEngineError,
  type EngineProviderId,
  type SuggestionEngine,
  type SuggestionPrompt,
  type SuggestOptions,
} from './types';

export type AnthropicSuggestionEngineConfig = {
  apiKey: string;
  /** Default `claude-haiku-4-5-20251001`. Set via `SUGGESTION_ENGINE_MODEL`. */
  model?: string;
  baseURL?: string;
};

/**
 * Anthropic implementation of `SuggestionEngine`. Uses tool-use with a single
 * forced tool whose `input_schema` mirrors our JSON Schema, so the model is
 * required to emit a structured tool call rather than free-form prose.
 */
export class AnthropicSuggestionEngine implements SuggestionEngine {
  readonly providerId: EngineProviderId = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: AnthropicSuggestionEngineConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model ?? 'claude-haiku-4-5-20251001';
  }

  async suggest<T>(
    prompt: SuggestionPrompt,
    schema: ZodSchema<T>,
    opts: SuggestOptions = {}
  ): Promise<T> {
    if (!prompt.jsonSchema) {
      throw new SuggestionEngineError(
        'engine_response_invalid',
        'Anthropic provider requires SuggestionPrompt.jsonSchema for tool-use.'
      );
    }
    const localeNote = opts.locale ? `\nReply in the operator's locale: ${opts.locale}.` : '';
    const ac = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 20_000;
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const toolName = `emit_${prompt.schemaName}`;
    let raw: unknown;
    try {
      const message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 1500,
          temperature: 0.3,
          system: prompt.system + localeNote,
          messages: [{ role: 'user', content: prompt.user }],
          tools: [
            {
              name: toolName,
              description: prompt.schemaDescription,
              input_schema: prompt.jsonSchema as never,
            },
          ],
          tool_choice: { type: 'tool', name: toolName },
        },
        { signal: ac.signal }
      );
      const toolUse = message.content.find(
        (block) => block.type === 'tool_use' && block.name === toolName
      );
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new SuggestionEngineError(
          'engine_response_invalid',
          'Anthropic did not return a tool_use block.'
        );
      }
      raw = toolUse.input;
    } catch (e) {
      if (e instanceof SuggestionEngineError) throw e;
      const err = e as Error & { status?: number; name?: string };
      if (err.name === 'AbortError') {
        throw new SuggestionEngineError(
          'engine_timeout',
          `Anthropic timed out after ${timeoutMs}ms`
        );
      }
      if (err.status === 429) {
        throw new SuggestionEngineError('engine_rate_limited', 'Anthropic rate-limited');
      }
      throw new SuggestionEngineError('engine_unavailable', `Anthropic error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new SuggestionEngineError(
        'engine_response_invalid',
        `Anthropic response failed schema validation: ${parsed.error.message}`
      );
    }
    return parsed.data;
  }
}
