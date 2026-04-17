import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { queryFanoutSimulationCache } from './query-fanout-simulation-cache.schema';
import { SIMULATOR_RESPONSE_ZOD } from './query-fanout-simulator.prompt';
import type {
  SimulatedSubQuery,
  SimulationIntent,
  SimulationProvider,
  SimulationUsage,
} from './query-fanout-simulator.types';

export interface CacheLookup {
  subQueries: SimulatedSubQuery[];
  modelVersion: string;
}

export async function findAndBumpCacheRow(
  promptHash: string,
  modelId: string
): Promise<CacheLookup | null> {
  const [row] = await db
    .select()
    .from(queryFanoutSimulationCache)
    .where(
      and(
        eq(queryFanoutSimulationCache.promptHash, promptHash),
        eq(queryFanoutSimulationCache.modelId, modelId)
      )
    )
    .limit(1);

  if (!row) return null;

  // Defensive re-validate: a poisoned cache row should count as a miss.
  const parsed = SIMULATOR_RESPONSE_ZOD.safeParse({ subQueries: row.subQueries });
  if (!parsed.success) {
    logger.warn(
      { cacheRowId: row.id },
      'query-fanout cache row failed Zod validation; treating as cache miss'
    );
    return null;
  }

  // Bump hitCount inline. Write volume is low — debouncing earns nothing.
  await db
    .update(queryFanoutSimulationCache)
    .set({
      hitCount: sql`${queryFanoutSimulationCache.hitCount} + 1`,
      lastHitAt: new Date(),
    })
    .where(eq(queryFanoutSimulationCache.id, row.id));

  return {
    subQueries: parsed.data.subQueries.map((sq) => ({
      text: sq.text,
      intentType: sq.intentType as SimulationIntent,
      priority: sq.priority,
      reasoning: sq.reasoning,
    })),
    modelVersion: row.modelVersion,
  };
}

export interface PersistCacheInput {
  promptHash: string;
  provider: SimulationProvider;
  modelId: string;
  modelVersion: string;
  subQueries: SimulatedSubQuery[];
  usage: SimulationUsage | null | undefined;
}

export async function persistCacheRow(input: PersistCacheInput): Promise<void> {
  await db
    .insert(queryFanoutSimulationCache)
    .values({
      promptHash: input.promptHash,
      provider: input.provider,
      modelId: input.modelId,
      modelVersion: input.modelVersion,
      subQueries: input.subQueries,
      subQueryCount: input.subQueries.length,
      inputTokens: input.usage?.inputTokens ?? null,
      outputTokens: input.usage?.outputTokens ?? null,
    })
    .onConflictDoUpdate({
      target: [
        queryFanoutSimulationCache.promptHash,
        queryFanoutSimulationCache.modelId,
        queryFanoutSimulationCache.modelVersion,
      ],
      set: {
        subQueries: input.subQueries,
        subQueryCount: input.subQueries.length,
        provider: input.provider,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        updatedAt: new Date(),
      },
    });
}
