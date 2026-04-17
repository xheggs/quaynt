import { apiFetch } from '@/lib/query/fetch';

export interface QueryFanoutSource {
  id: string;
  url: string;
  title: string | null;
  citationId: string | null;
}

export interface QueryFanoutSubQuery {
  id: string;
  text: string;
  metadata: Record<string, unknown> | null;
  sources: QueryFanoutSource[];
  isSimulated: boolean;
  intentType: string | null;
  simulationProvider: string | null;
  simulationModel: string | null;
}

export interface QueryFanoutTree {
  modelRunResultId: string;
  platformId: string;
  promptId: string;
  promptText: string;
  rootMetadata: Record<string, unknown> | null;
  subQueries: QueryFanoutSubQuery[];
  rootSources: QueryFanoutSource[];
}

interface QueryFanoutResponse {
  data: QueryFanoutTree[];
  meta: {
    totalResults: number;
    totalSubQueries: number;
    totalSimulatedSubQueries: number;
    totalSources: number;
  };
}

export type QueryFanoutSourceFilter = 'observed' | 'simulated' | 'both';

export async function fetchQueryFanoutForResult(
  modelRunId: string,
  modelRunResultId: string,
  source: QueryFanoutSourceFilter = 'both'
): Promise<QueryFanoutTree[]> {
  const params = new URLSearchParams({ modelRunId, modelRunResultId, source });
  const response = await apiFetch<QueryFanoutResponse>(
    `/visibility/query-fanout?${params.toString()}`
  );
  return response.data;
}

// -- Simulate mutation ----------------------------------------------------

export type SimulateFailureReason =
  | 'no_simulation_provider_configured'
  | 'simulation_parse_failed'
  | 'simulation_rate_limited'
  | 'simulation_timeout'
  | 'simulation_failed';

export interface SimulateSuccess {
  simulation: {
    provider: 'openai' | 'anthropic' | 'gemini';
    modelId: string;
    modelVersion: string | null;
    cacheHit: boolean;
    elapsedMs: number;
    subQueries: Array<{
      text: string;
      intentType: string;
      priority: number;
      reasoning?: string;
    }>;
  };
  nodesInserted: number;
}

export interface SimulateFailure {
  failure: {
    reason: SimulateFailureReason;
    retryAfterMs?: number;
  };
}

export type SimulateResult = SimulateSuccess | SimulateFailure;

interface SimulateResponseRaw {
  data: {
    simulation: SimulateSuccess['simulation'];
    nodesInserted: number;
  } | null;
  meta?: {
    status?: 'simulation_failed';
    reason?: SimulateFailureReason;
    retryAfterMs?: number;
  };
}

export async function simulateQueryFanout(input: {
  promptId: string;
  modelRunId?: string;
  modelRunResultId?: string;
}): Promise<SimulateResult> {
  const response = await apiFetch<SimulateResponseRaw>(`/visibility/query-fanout/simulate`, {
    method: 'POST',
    body: {
      promptId: input.promptId,
      modelRunId: input.modelRunId,
      modelRunResultId: input.modelRunResultId,
    },
  });

  if (response.meta?.status === 'simulation_failed' && response.meta.reason) {
    return {
      failure: {
        reason: response.meta.reason,
        retryAfterMs: response.meta.retryAfterMs,
      },
    };
  }

  if (!response.data) {
    return { failure: { reason: 'simulation_failed' } };
  }

  return {
    simulation: response.data.simulation,
    nodesInserted: response.data.nodesInserted,
  };
}
