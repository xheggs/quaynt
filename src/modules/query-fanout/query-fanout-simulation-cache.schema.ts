import { pgTable, text, integer, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';

/**
 * Cache of LLM-simulated query fan-outs.
 *
 * Keyed on the hash of the *normalised* prompt text + the provider's model
 * identifier so identical prompts across workspaces reuse the same simulation
 * — material savings on per-API-call spend for a self-hosted deployment. The
 * cache never returns the original prompt text (only the output sub-queries),
 * so sharing across workspaces doesn't leak prompt content.
 *
 * Cache invalidation: rows older than `QUERY_FANOUT_SIMULATION_CACHE_TTL_DAYS`
 * with `lastHitAt` null are pruned by the weekly cleanup job. Model upgrades
 * invalidate naturally because `(modelId, modelVersion)` is part of the key.
 */
export const queryFanoutSimulationCache = pgTable(
  'query_fanout_simulation_cache',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('queryFanoutSimulationCache')),
    /** SHA-256 of the normalised prompt text (hex-encoded, lowercase). Cache is workspace-independent. */
    promptHash: text().notNull(),
    /** Provider identifier (`openai` | `anthropic` | `gemini`). */
    provider: text().notNull(),
    /** Model id used, e.g., `gpt-4o-mini`, `gemini-2.5-flash`. */
    modelId: text().notNull(),
    /** Provider-reported version string. Empty string for providers that embed the version in modelId. */
    modelVersion: text().notNull().default(''),
    /** Array of SimulatedSubQuery objects (see query-fanout-simulator.types). */
    subQueries: jsonb().notNull(),
    subQueryCount: integer().notNull(),
    /** Denormalised token counts from the provider for cost telemetry. Null when unknown. */
    inputTokens: integer(),
    outputTokens: integer(),
    /** When the cache row was first populated. */
    generatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    hitCount: integer().notNull().default(0),
    lastHitAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('query_fanout_simulation_cache_key_idx').on(
      table.promptHash,
      table.modelId,
      table.modelVersion
    ),
    index('query_fanout_simulation_cache_generated_at_idx').on(table.generatedAt),
    index('query_fanout_simulation_cache_last_hit_at_idx').on(table.lastHitAt),
  ]
);
