import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { platformAdapter } from '@/modules/adapters/adapter.schema';
import { decryptCredential } from '@/modules/adapters/adapter.crypto';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';
import type { SimulatorResponsePayload } from './query-fanout-simulator.prompt';
import { findAndBumpCacheRow, persistCacheRow } from './query-fanout-simulator.cache';
import { callProvider } from './query-fanout-simulator.providers';
import {
  SimulationNoProviderError,
  type SimulatedSubQuery,
  type SimulationIntent,
  type SimulationOptions,
  type SimulationProvider,
  type SimulationResult,
  type SimulationUsage,
} from './query-fanout-simulator.types';

/**
 * Which platform id the adapter_config row must carry for a given simulation
 * provider. OpenAI simulations draw on the `chatgpt` adapter, Anthropic on the
 * `claude` adapter, Gemini on the `gemini` adapter.
 */
const PROVIDER_TO_ADAPTER_PLATFORM_ID: Record<SimulationProvider, string> = {
  openai: 'chatgpt',
  anthropic: 'claude',
  gemini: 'gemini',
};

// Cheapest credible defaults. Override via SimulationOptions.modelOverride.
export function resolveSimulationModel(provider: SimulationProvider, override?: string): string {
  if (override && override.trim().length > 0) return override.trim();
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-haiku-4-5-20251001';
    case 'gemini':
      return 'gemini-2.5-flash';
  }
}

/**
 * Normalise a prompt before hashing: trim, lowercase, collapse whitespace.
 *
 * Different workspaces that type the same prompt with different casing or
 * spacing hit the same cache row — this is the primary reuse lever.
 */
export function normalisePromptForHash(promptText: string): string {
  return promptText.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hashPrompt(promptText: string): string {
  return createHash('sha256').update(normalisePromptForHash(promptText)).digest('hex');
}

// -- Provider credential resolution ----------------------------------------

interface ResolvedCredential {
  apiKey: string;
  adapterConfigId: string;
}

/**
 * Resolve + decrypt the credential for a given simulation provider in a
 * workspace. Throws `SimulationNoProviderError` if no adapter config exists.
 *
 * The adapter config must be enabled and not soft-deleted — mirrors the
 * citation pipeline's `loadAdapterConfig` rules.
 */
export async function getAdapterCredential(
  workspaceId: string,
  provider: SimulationProvider
): Promise<ResolvedCredential> {
  const platformId = PROVIDER_TO_ADAPTER_PLATFORM_ID[provider];
  const [record] = await db
    .select({
      id: platformAdapter.id,
      credentials: platformAdapter.credentials,
    })
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.workspaceId, workspaceId),
        eq(platformAdapter.platformId, platformId),
        eq(platformAdapter.enabled, true)
      )
    )
    .limit(1);

  if (!record) {
    throw new SimulationNoProviderError(
      `No enabled ${provider} adapter is configured for this workspace`
    );
  }

  if (
    record.credentials === null ||
    typeof record.credentials !== 'object' ||
    !('ciphertext' in (record.credentials as Record<string, unknown>))
  ) {
    throw new SimulationNoProviderError(
      `The ${provider} adapter has no encrypted credential configured`
    );
  }

  const decrypted = JSON.parse(decryptCredential(record.credentials as EncryptedValue)) as Record<
    string,
    unknown
  >;

  // Accept both `apiKey` and `api_key` shapes — both appear in the codebase.
  const apiKey =
    typeof decrypted.apiKey === 'string'
      ? decrypted.apiKey
      : typeof decrypted.api_key === 'string'
        ? decrypted.api_key
        : null;

  if (!apiKey) {
    throw new SimulationNoProviderError(
      `The ${provider} adapter credential is missing the API key field`
    );
  }

  return { apiKey, adapterConfigId: record.id };
}

// -- Main entry point -------------------------------------------------------

export interface SimulateFanoutInput {
  promptText: string;
  options?: SimulationOptions;
}

/**
 * Generate or retrieve a Qforia-style simulated fan-out for a prompt.
 *
 * Flow:
 *   1. Normalise + hash the prompt.
 *   2. Look up the shared cache keyed on (promptHash, modelId, modelVersion).
 *      Cache hits bump `hitCount` + `lastHitAt` inline.
 *   3. On miss: resolve workspace adapter credential for the chosen provider,
 *      call the provider with a structured-output request, parse, cap,
 *      persist to cache, return.
 *
 * Errors (subclasses of `SimulationError`):
 *   - `SimulationNoProviderError`
 *   - `SimulationTimeoutError`
 *   - `SimulationRateLimitError` (carries `retryAfterMs`)
 *   - `SimulationParseError`
 */
export async function simulateFanout(
  workspaceId: string,
  input: SimulateFanoutInput
): Promise<SimulationResult> {
  const start = Date.now();
  const { promptText } = input;
  const options = input.options ?? {};

  const provider: SimulationProvider =
    options.provider ?? (env.QUERY_FANOUT_SIMULATION_PROVIDER as SimulationProvider);
  const modelId = resolveSimulationModel(provider, options.modelOverride);
  const promptHash = hashPrompt(promptText);
  const maxSubQueries = env.QUERY_FANOUT_SIMULATION_MAX_SUB_QUERIES;

  // Cache lookup — keyed on (promptHash, modelId, modelVersion=''). We store
  // modelVersion as the empty string for providers that embed the version in
  // the model id, so the unique index still matches on an empty string.
  const cacheHit = await findAndBumpCacheRow(promptHash, modelId);
  if (cacheHit) {
    return {
      subQueries: cacheHit.subQueries,
      provider,
      modelId,
      modelVersion: cacheHit.modelVersion || null,
      cacheHit: true,
      elapsedMs: Date.now() - start,
      usage: null,
    };
  }

  const credential = await getAdapterCredential(workspaceId, provider);

  const raw = await callProvider({
    provider,
    apiKey: credential.apiKey,
    modelId,
    promptText,
    temperature: options.temperature ?? 0,
    subQueryTarget: options.subQueryTarget ?? 12,
  });

  const validated = validateAndCap(raw.payload, maxSubQueries);

  const elapsedMs = Date.now() - start;

  await persistCacheRow({
    promptHash,
    provider,
    modelId,
    modelVersion: raw.modelVersion ?? '',
    subQueries: validated,
    usage: raw.usage,
  });

  // Cost telemetry (Task 8). No prompt text — only workspace + provider meta.
  logger.info(
    {
      event: 'query_fanout.simulation',
      workspaceId,
      provider,
      modelId,
      inputTokens: raw.usage?.inputTokens ?? null,
      outputTokens: raw.usage?.outputTokens ?? null,
      approxUsdMicros: approximateCostUsdMicros(provider, raw.usage),
      cacheHit: false,
      elapsedMs,
    },
    'query-fanout simulation completed'
  );

  return {
    subQueries: validated,
    provider,
    modelId,
    modelVersion: raw.modelVersion ?? null,
    cacheHit: false,
    elapsedMs,
    usage: raw.usage ?? null,
  };
}

// -- Response validation + cap ---------------------------------------------

function validateAndCap(
  payload: SimulatorResponsePayload,
  maxSubQueries: number
): SimulatedSubQuery[] {
  const capped = payload.subQueries.slice(0, maxSubQueries);
  return capped.map((sq) => ({
    text: sq.text,
    intentType: sq.intentType as SimulationIntent,
    priority: sq.priority,
    reasoning: sq.reasoning,
  }));
}

// -- Telemetry: rough cost estimate ----------------------------------------

/**
 * Approximate cost in micro-USD (USD × 1_000_000). Deliberately imprecise —
 * only intended to power "are we spending 10x more than expected" alerts. Exact
 * billing comes from the provider invoice.
 */
function approximateCostUsdMicros(
  provider: SimulationProvider,
  usage: SimulationUsage | null | undefined
): number | null {
  if (!usage || usage.inputTokens === null || usage.outputTokens === null) return null;
  const rates = COST_RATES_PER_MILLION[provider];
  const input = (usage.inputTokens / 1_000_000) * rates.inputUsd;
  const output = (usage.outputTokens / 1_000_000) * rates.outputUsd;
  return Math.round((input + output) * 1_000_000);
}

/** USD per million tokens. Tuned for the cheapest default models; update when defaults change. */
const COST_RATES_PER_MILLION: Record<SimulationProvider, { inputUsd: number; outputUsd: number }> =
  {
    openai: { inputUsd: 0.15, outputUsd: 0.6 }, // gpt-4o-mini
    anthropic: { inputUsd: 1.0, outputUsd: 5.0 }, // claude-haiku
    gemini: { inputUsd: 0.3, outputUsd: 2.5 }, // gemini-2.5-flash
  };
