import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  UserPreference,
  UserPreferenceUpdate,
  WorkspaceDetails,
  WorkspaceUpdate,
  WorkspaceMember,
  AddMemberInput,
  UpdateMemberRoleInput,
} from './settings.types';

// --- User Preferences ---

export function fetchUserPreferences(): Promise<UserPreference> {
  return apiFetch<UserPreference>('/user/preferences');
}

export function updateUserPreferences(input: UserPreferenceUpdate): Promise<UserPreference> {
  return apiFetch<UserPreference>('/user/preferences', {
    method: 'PATCH',
    body: input,
  });
}

// --- Workspace ---

export function fetchWorkspace(): Promise<WorkspaceDetails> {
  return apiFetch<WorkspaceDetails>('/workspace');
}

export function updateWorkspace(input: WorkspaceUpdate): Promise<WorkspaceDetails> {
  return apiFetch<WorkspaceDetails>('/workspace', {
    method: 'PATCH',
    body: input,
  });
}

// --- Members ---

export function fetchMembers(params?: QueryFilters): Promise<PaginatedResponse<WorkspaceMember>> {
  return apiFetchPaginated<WorkspaceMember>('/workspace/members', { ...params });
}

export function addMember(input: AddMemberInput): Promise<WorkspaceMember> {
  return apiFetch<WorkspaceMember>('/workspace/members', {
    method: 'POST',
    body: input,
  });
}

export function updateMemberRole(
  memberId: string,
  input: UpdateMemberRoleInput
): Promise<WorkspaceMember> {
  return apiFetch<WorkspaceMember>(`/workspace/members/${memberId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removeMember(memberId: string): Promise<void> {
  return apiFetch<void>(`/workspace/members/${memberId}`, {
    method: 'DELETE',
  });
}
