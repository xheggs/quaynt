import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  listGscConnections,
  startGscOauth,
  getPendingGscOauth,
  confirmGscConnection,
  deleteGscConnection,
} from './gsc.api';

export function useGscConnectionsQuery() {
  return useQuery({
    queryKey: queryKeys.gscConnections.lists(),
    queryFn: listGscConnections,
    staleTime: 60_000,
  });
}

export function useStartGscOauthMutation() {
  return useMutation({
    mutationFn: startGscOauth,
  });
}

export function usePendingGscOauthQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.gscConnections.detail('pending'),
    queryFn: getPendingGscOauth,
    enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useConfirmGscConnectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmGscConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gscConnections.all });
      qc.invalidateQueries({ queryKey: queryKeys.gscCorrelation.all });
    },
  });
}

export function useDeleteGscConnectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGscConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gscConnections.all });
      qc.invalidateQueries({ queryKey: queryKeys.gscCorrelation.all });
    },
  });
}
