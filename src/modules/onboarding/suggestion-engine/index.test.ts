// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getSuggestionEngine } from './index';

describe('getSuggestionEngine', () => {
  it('returns null when ONBOARDING_SUGGEST_DISABLED is true', () => {
    expect(
      getSuggestionEngine({
        ONBOARDING_SUGGEST_DISABLED: 'true',
        SUGGESTION_ENGINE_PROVIDER: 'openai',
        SUGGESTION_ENGINE_API_KEY: 'sk-test',
      } as never)
    ).toBeNull();
  });

  it('returns null when no provider configured (OSS default)', () => {
    expect(getSuggestionEngine({} as never)).toBeNull();
  });

  it('returns null when provider configured but key missing', () => {
    expect(getSuggestionEngine({ SUGGESTION_ENGINE_PROVIDER: 'openai' } as never)).toBeNull();
  });

  it('returns null for unknown provider', () => {
    expect(
      getSuggestionEngine({
        SUGGESTION_ENGINE_PROVIDER: 'mystery',
        SUGGESTION_ENGINE_API_KEY: 'k',
      } as never)
    ).toBeNull();
  });

  it('returns OpenAI engine when configured', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openai',
      SUGGESTION_ENGINE_API_KEY: 'sk-test',
    } as never);
    expect(engine?.providerId).toBe('openai');
  });

  it('returns Anthropic engine when configured', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'anthropic',
      SUGGESTION_ENGINE_API_KEY: 'sk-test',
    } as never);
    expect(engine?.providerId).toBe('anthropic');
  });

  it('case-insensitive provider lookup', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'OpenAI',
      SUGGESTION_ENGINE_API_KEY: 'sk-test',
    } as never);
    expect(engine?.providerId).toBe('openai');
  });

  it('returns OpenRouter engine when provider, key, and model are all set', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openrouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL: 'openai/gpt-4o-mini',
    } as never);
    expect(engine?.providerId).toBe('openrouter');
  });

  it('returns null for openrouter without SUGGESTION_ENGINE_MODEL', () => {
    expect(
      getSuggestionEngine({
        SUGGESTION_ENGINE_PROVIDER: 'openrouter',
        SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      } as never)
    ).toBeNull();
  });

  it('normalizes openrouter casing', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'OpenRouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL: 'openai/gpt-4o-mini',
    } as never);
    expect(engine?.providerId).toBe('openrouter');
  });

  it('OpenRouter wrapper strips strict json_schema from prompts by default', async () => {
    const { OpenRouterSuggestionEngine } = await import('./openrouter-provider');
    const engine = new OpenRouterSuggestionEngine({
      apiKey: 'sk-or-v1-test',
      model: 'google/gemma-4-31b-it:free',
    });
    // Spy on the inner OpenAi engine's suggest() to capture the prompt it sees.
    const inner = (engine as unknown as { inner: { suggest: typeof Function.prototype } }).inner;
    let captured: { jsonSchema?: unknown } | null = null;
    inner.suggest = ((p: { jsonSchema?: unknown }) => {
      captured = p;
      return Promise.resolve('ok');
    }) as never;
    await engine.suggest(
      {
        system: 's',
        user: 'u',
        schemaName: 'n',
        schemaDescription: 'd',
        jsonSchema: { type: 'object' },
      },
      { safeParse: () => ({ success: true, data: 'ok' }) } as never
    );
    expect(captured).not.toBeNull();
    expect(captured!.jsonSchema).toBeUndefined();
  });

  it('OpenRouter wrapper preserves jsonSchema when strictJsonSchema=true', async () => {
    const { OpenRouterSuggestionEngine } = await import('./openrouter-provider');
    const engine = new OpenRouterSuggestionEngine({
      apiKey: 'sk-or-v1-test',
      model: 'openai/gpt-4o-mini',
      strictJsonSchema: true,
    });
    const inner = (engine as unknown as { inner: { suggest: typeof Function.prototype } }).inner;
    let captured: { jsonSchema?: unknown } | null = null;
    inner.suggest = ((p: { jsonSchema?: unknown }) => {
      captured = p;
      return Promise.resolve('ok');
    }) as never;
    await engine.suggest(
      {
        system: 's',
        user: 'u',
        schemaName: 'n',
        schemaDescription: 'd',
        jsonSchema: { type: 'object' },
      },
      { safeParse: () => ({ success: true, data: 'ok' }) } as never
    );
    expect(captured).not.toBeNull();
    expect(captured!.jsonSchema).toEqual({ type: 'object' });
  });

  it('resolver propagates SUGGESTION_ENGINE_STRICT_JSON_SCHEMA=true', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openrouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL: 'openai/gpt-4o-mini',
      SUGGESTION_ENGINE_STRICT_JSON_SCHEMA: 'true',
    } as never);
    expect((engine as unknown as { strictJsonSchema: boolean } | null)?.strictJsonSchema).toBe(
      true
    );
  });

  it('single-model SUGGESTION_ENGINE_MODEL still resolves (back-compat, no extraBody)', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openrouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL: 'openai/gpt-oss-120b:free',
    } as never);
    expect(engine?.providerId).toBe('openrouter');
    const innerExtraBody = (
      engine as unknown as { inner: { extraBody?: Record<string, unknown> } } | null
    )?.inner?.extraBody;
    expect(innerExtraBody).toBeUndefined();
  });

  it('comma-separated SUGGESTION_ENGINE_MODEL forwards a models[] list', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openrouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL:
        'google/gemma-4-31b-it:free,openai/gpt-oss-120b:free,meta-llama/llama-3.3-70b-instruct:free',
    } as never);
    const innerExtraBody = (
      engine as unknown as { inner: { extraBody?: { models?: string[] } } } | null
    )?.inner?.extraBody;
    expect(innerExtraBody?.models).toEqual([
      'google/gemma-4-31b-it:free',
      'openai/gpt-oss-120b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ]);
  });

  it('tolerates whitespace and empty entries in the model list', () => {
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openrouter',
      SUGGESTION_ENGINE_API_KEY: 'sk-or-v1-test',
      SUGGESTION_ENGINE_MODEL: ' a/foo ,, b/bar ,a/foo, c/baz ',
    } as never);
    const innerExtraBody = (
      engine as unknown as { inner: { extraBody?: { models?: string[] } } } | null
    )?.inner?.extraBody;
    // Trims, drops empties, dedupes (a/foo appears twice in input).
    expect(innerExtraBody?.models).toEqual(['a/foo', 'b/bar', 'c/baz']);
  });

  it('passes SUGGESTION_ENGINE_BASE_URL through for self-hosted openai-compatible endpoints', async () => {
    const { OpenAiSuggestionEngine } = await import('./openai-provider');
    const engine = getSuggestionEngine({
      SUGGESTION_ENGINE_PROVIDER: 'openai',
      SUGGESTION_ENGINE_API_KEY: 'ollama',
      SUGGESTION_ENGINE_MODEL: 'llama3.2',
      SUGGESTION_ENGINE_BASE_URL: 'http://localhost:11434/v1',
    } as never);
    expect(engine).toBeInstanceOf(OpenAiSuggestionEngine);
    // The OpenAI SDK client stores baseURL at runtime; verify it landed there.
    const baseURL = (engine as unknown as { client: { baseURL: string } } | null)?.client?.baseURL;
    expect(baseURL).toBe('http://localhost:11434/v1');
  });
});
