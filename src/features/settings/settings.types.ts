/**
 * Client-side settings types.
 *
 * These mirror server-side types but are duplicated here to avoid importing
 * from server modules, which can break client component bundling.
 */

// Source: @/modules/user/user-preference.schema
export interface UserPreference {
  id: string;
  userId: string;
  locale: string | null;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/user/user-preference.service
export interface UserPreferenceUpdate {
  locale?: string | null;
}

// Source: better-auth session user
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

// Source: better-auth updateUser
export interface UserProfileUpdate {
  name?: string;
}

// Source: @/modules/workspace/workspace.schema
export interface WorkspaceDetails {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/workspace/workspace.service
export interface WorkspaceUpdate {
  name: string;
}

// Source: @/modules/workspace/workspace.service (listWorkspaceMembers)
export interface WorkspaceMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface AddMemberInput {
  email: string;
  role: 'admin' | 'member';
}

export interface UpdateMemberRoleInput {
  role: WorkspaceRole;
}

// --- Helper constants ---

export const WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'member'];

export const ASSIGNABLE_ROLES: Array<'admin' | 'member'> = ['admin', 'member'];

export const SUPPORTED_LOCALES = ['en'] as const;
