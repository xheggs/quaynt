import { useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  createSuggestion,
  getSuggestion,
  type CreateSuggestionInput,
  type SuggestionDto,
} from '../api/suggest';

const POLL_INTERVAL_MS = 1500;

export function useCreateSuggestion() {
  return useMutation({
    mutationFn: (input: string | CreateSuggestionInput) => createSuggestion(input),
  });
}

/**
 * Polls the suggestion job at 1.5 s until it lands in a terminal state
 * (`done` or `failed`). Stops polling once terminal.
 */
export function useSuggestion(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.onboardingSuggestion.detail(jobId ?? 'none'),
    queryFn: () => getSuggestion(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as SuggestionDto | undefined;
      if (!data) return POLL_INTERVAL_MS;
      if (data.status === 'done' || data.status === 'failed') return false;
      return POLL_INTERVAL_MS;
    },
    staleTime: 0,
  });
}
