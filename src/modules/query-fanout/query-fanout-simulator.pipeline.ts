import type { PgBoss } from 'pg-boss';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { modelRunResult } from '@/modules/model-runs/model-run.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { insertFanoutTree } from './query-fanout.service';
import { simulateFanout } from './query-fanout-simulator.service';
import type { SimulationOptions, SimulationResult } from './query-fanout-simulator.types';
import type { ObservedFanoutTree } from './query-fanout.types';

export interface RunSimulationPipelineInput {
  workspaceId: string;
  promptId: string;
  /** Optional — when present, the simulation is scoped to a specific model run. */
  modelRunId?: string | null;
  /** Optional — when present, further narrows to a single run-result. */
  modelRunResultId?: string | null;
  options?: SimulationOptions;
  boss: PgBoss;
}

export interface RunSimulationPipelineResult {
  simulation: SimulationResult;
  nodesInserted: number;
  /** Null when the caller-supplied promptId doesn't belong to the workspace. */
  promptFound: boolean;
}

/**
 * On-demand simulated fan-out pipeline.
 *
 * 1. Load the prompt (workspace-scoped) — returns early if missing.
 * 2. Call the LLM simulator (cache-first; see simulateFanout).
 * 3. Resolve `platformId` by inheriting from a model-run-result when one is
 *    given, or leaving null for orchestration-free simulations.
 * 4. Build an `ObservedFanoutTree`-shaped payload with `intentType` tucked
 *    into each sub-query's metadata (`insertFanoutTree` reads it back out).
 * 5. Insert via the shared `insertFanoutTree` helper with
 *    `source='simulated'`, `simulationProvider`, `simulationModel`.
 * 6. Dispatch the `query_fanout.simulated` webhook.
 */
export async function runSimulationPipeline(
  input: RunSimulationPipelineInput
): Promise<RunSimulationPipelineResult> {
  const { workspaceId, promptId, modelRunId, modelRunResultId, options, boss } = input;

  // Step 1: workspace-scoped prompt fetch via the promptSet join.
  const [promptRow] = await db
    .select({ id: prompt.id, template: prompt.template })
    .from(prompt)
    .innerJoin(promptSet, eq(prompt.promptSetId, promptSet.id))
    .where(and(eq(prompt.id, promptId), eq(promptSet.workspaceId, workspaceId)))
    .limit(1);

  if (!promptRow) {
    return {
      simulation: {
        subQueries: [],
        provider: options?.provider ?? 'openai',
        modelId: '',
        modelVersion: null,
        cacheHit: false,
        elapsedMs: 0,
      },
      nodesInserted: 0,
      promptFound: false,
    };
  }

  // Step 2: simulate.
  const simulation = await simulateFanout(workspaceId, {
    promptText: promptRow.template,
    options,
  });

  // Step 3: resolve platformId from the run context when present.
  let platformId: string | null = null;
  if (modelRunResultId) {
    const [resultRow] = await db
      .select({ platformId: modelRunResult.platformId })
      .from(modelRunResult)
      .where(eq(modelRunResult.id, modelRunResultId))
      .limit(1);
    if (resultRow) platformId = resultRow.platformId;
  }

  // Step 4: build ObservedFanoutTree-shaped payload. We stash intentType in
  // each sub-query's metadata; insertFanoutTree lifts it back into the
  // dedicated column.
  const tree: ObservedFanoutTree = {
    root: { text: promptRow.template },
    subQueries: simulation.subQueries.map((sq) => ({
      text: sq.text,
      sources: [],
      metadata: {
        intentType: sq.intentType,
        priority: sq.priority,
        ...(sq.reasoning ? { reasoning: sq.reasoning } : {}),
      },
    })),
    rootSources: [],
    metadata: {
      simulator: true,
      provider: simulation.provider,
      modelId: simulation.modelId,
      modelVersion: simulation.modelVersion,
      cacheHit: simulation.cacheHit,
    },
  };

  // Step 5: insert.
  const insertResult = await db.transaction(async (tx) => {
    return insertFanoutTree(tx, {
      workspaceId,
      modelRunId: modelRunId ?? null,
      modelRunResultId: modelRunResultId ?? null,
      platformId,
      promptId: promptRow.id,
      tree,
      source: 'simulated',
      simulationProvider: simulation.provider,
      simulationModel: simulation.modelId,
      citationByNormalizedUrl: new Map(),
    });
  });

  // Step 6: webhook.
  try {
    await dispatchWebhookEvent(
      workspaceId,
      'query_fanout.simulated',
      {
        promptId: promptRow.id,
        modelRunId: modelRunId ?? null,
        modelRunResultId: modelRunResultId ?? null,
        provider: simulation.provider,
        modelId: simulation.modelId,
        modelVersion: simulation.modelVersion,
        subQueryCount: simulation.subQueries.length,
        cacheHit: simulation.cacheHit,
        mode: 'simulated',
      },
      boss
    );
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to dispatch query_fanout.simulated webhook (rows persisted)'
    );
  }

  return {
    simulation,
    nodesInserted: insertResult.insertedNodes,
    promptFound: true,
  };
}
