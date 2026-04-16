'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { fetchUserPreferences, fetchWorkspace, fetchMembers } from './settings.api';
import type { UserPreference, WorkspaceDetails, WorkspaceMember } from './settings.types';

export function useUserPreferencesQuery() {
  return useQuery<UserPreference>({
    queryKey: queryKeys.userPreferences.all,
    queryFn: () => fetchUserPreferences(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useWorkspaceQuery() {
  return useQuery<WorkspaceDetails>({
    queryKey: queryKeys.workspace.all,
    queryFn: () => fetchWorkspace(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMembersQuery() {
  return usePaginatedQuery<WorkspaceMember>({
    queryKey: (params) => queryKeys.members.list({ ...params }),
    queryFn: (params) => fetchMembers(params),
    defaultSort: 'joinedAt',
  });
}
