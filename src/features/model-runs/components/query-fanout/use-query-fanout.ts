'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  fetchQueryFanoutForResult,
  simulateQueryFanout,
  type QueryFanoutSourceFilter,
  type SimulateResult,
} from './query-fanout.api';

/**
 * Fetch the query fan-out for a single model-run-result.
 *
 * Callers pass `source` to narrow to observed or simulated rows. Data is
 * effectively immutable once extracted — `staleTime: Infinity` suppresses
 * refetches. The simulate mutation invalidates the corresponding key on
 * success so fresh simulations show up immediately.
 */
export function useQueryFanout(
  modelRunId: string,
  modelRunResultId: string,
  enabled: boolean,
  source: QueryFanoutSourceFilter = 'both'
) {
  return useQuery({
    queryKey: [...queryKeys.queryFanout.detail(modelRunResultId), source],
    queryFn: () => fetchQueryFanoutForResult(modelRunId, modelRunResultId, source),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * Run an on-demand LLM-simulated fan-out. Invalidates every cached tree for
 * the target result so the panel re-fetches and renders the new simulated
 * sub-queries.
 *
 * The mutation resolves with a `SimulateResult` that discriminates between
 * success (`.simulation`) and failure (`.failure`) — UI branches on the
 * `.failure.reason` to render targeted error messaging.
 */
export function useSimulateQueryFanout(modelRunResultId: string) {
  const queryClient = useQueryClient();
  return useMutation<SimulateResult, Error, { promptId: string; modelRunId?: string }>({
    mutationFn: ({ promptId, modelRunId }) =>
      simulateQueryFanout({ promptId, modelRunId, modelRunResultId }),
    onSuccess: (result) => {
      // Invalidate all variants of this detail key so observed/both/simulated
      // views all refetch; cheaper than tracking sub-keys.
      if ('simulation' in result) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.queryFanout.detail(modelRunResultId),
        });
      }
    },
  });
}
