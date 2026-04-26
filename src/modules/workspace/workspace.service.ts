import { eq, and, desc, ilike, or, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { workspace, workspaceMember } from './workspace.schema';
import { user } from '@/modules/auth/auth.schema';
import { paginationConfig, sortConfig } from '@/lib/db/query-helpers';
import type { PaginationParams } from '@/lib/api/pagination';

const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

export async function getWorkspaceById(workspaceId: string) {
  const [record] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);

  return record ?? null;
}

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const [record] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);

  return record ?? null;
}

export async function getUserWorkspaces(userId: string) {
  return db
    .select({
      workspace,
      role: workspaceMember.role,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(eq(workspaceMember.userId, userId));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Insert a workspace + the owner workspace_member row using an externally
 * supplied transaction handle. Used by the signup auth hook so that the
 * workspace, starter prompt set, and onboarding row are all created
 * atomically — any failure rolls back the whole signup.
 */
export async function createWorkspaceForUserTx(tx: Tx, userId: string, name: string, slug: string) {
  const [ws] = await tx.insert(workspace).values({ name, slug, ownerId: userId }).returning();

  await tx.insert(workspaceMember).values({
    workspaceId: ws.id,
    userId,
    role: 'owner',
  });

  return ws;
}

export async function createWorkspaceForUser(userId: string, name: string, slug: string) {
  return db.transaction((tx) => createWorkspaceForUserTx(tx, userId, name, slug));
}

export async function requireWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new Error('Not a member of this workspace');
  }
  return membership;
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  minimumRole: 'member' | 'admin' | 'owner'
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new Error('Not a member of this workspace');
  }

  const userLevel = ROLE_HIERARCHY[membership.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient role: requires ${minimumRole}`);
  }

  return membership;
}

export function generateWorkspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'workspace'}-${suffix}`;
}

const MEMBER_SORT_COLUMNS: Record<string, typeof user.name | typeof workspaceMember.joinedAt> = {
  name: user.name,
  joinedAt: workspaceMember.joinedAt,
};

export const MEMBER_ALLOWED_SORTS = Object.keys(MEMBER_SORT_COLUMNS);

export async function listWorkspaceMembers(
  workspaceId: string,
  pagination: PaginationParams,
  search?: string
) {
  const conditions = [eq(workspaceMember.workspaceId, workspaceId)];

  if (search) {
    conditions.push(or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))!);
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, MEMBER_SORT_COLUMNS);

  const [items, [totalResult]] = await Promise.all([
    db
      .select({
        id: workspaceMember.id,
        userId: workspaceMember.userId,
        userName: user.name,
        userEmail: user.email,
        role: workspaceMember.role,
        joinedAt: workspaceMember.joinedAt,
      })
      .from(workspaceMember)
      .innerJoin(user, eq(workspaceMember.userId, user.id))
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(workspaceMember.joinedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(workspaceMember)
      .innerJoin(user, eq(workspaceMember.userId, user.id))
      .where(and(...conditions)),
  ]);

  return { items, total: totalResult?.count ?? 0 };
}

export async function addMemberByEmail(
  workspaceId: string,
  email: string,
  role: 'admin' | 'member'
) {
  const [foundUser] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);

  if (!foundUser) {
    throw new Error('USER_NOT_FOUND');
  }

  const existing = await getWorkspaceMembership(workspaceId, foundUser.id);
  if (existing) {
    throw new Error('ALREADY_A_MEMBER');
  }

  const [created] = await db
    .insert(workspaceMember)
    .values({
      workspaceId,
      userId: foundUser.id,
      role,
    })
    .returning();

  return {
    id: created.id,
    userId: foundUser.id,
    userName: foundUser.name,
    userEmail: foundUser.email,
    role: created.role,
    joinedAt: created.joinedAt,
  };
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  newRole: 'owner' | 'admin' | 'member',
  actorUserId: string
) {
  const [member] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.id, memberId), eq(workspaceMember.workspaceId, workspaceId)))
    .limit(1);

  if (!member) {
    throw new Error('MEMBER_NOT_FOUND');
  }

  if (member.userId === actorUserId) {
    throw new Error('CANNOT_CHANGE_OWN_ROLE');
  }

  // Prevent demoting the sole owner
  if (member.role === 'owner' && newRole !== 'owner') {
    const owners = await db
      .select({ id: workspaceMember.id })
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.role, 'owner')));

    if (owners.length <= 1) {
      throw new Error('CANNOT_REMOVE_SOLE_OWNER');
    }
  }

  const [updated] = await db
    .update(workspaceMember)
    .set({ role: newRole })
    .where(eq(workspaceMember.id, memberId))
    .returning();

  return updated;
}

export async function removeMember(workspaceId: string, memberId: string, actorUserId: string) {
  const [member] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.id, memberId), eq(workspaceMember.workspaceId, workspaceId)))
    .limit(1);

  if (!member) {
    throw new Error('MEMBER_NOT_FOUND');
  }

  if (member.userId === actorUserId) {
    throw new Error('CANNOT_REMOVE_SELF');
  }

  // Prevent removing the sole owner
  if (member.role === 'owner') {
    const owners = await db
      .select({ id: workspaceMember.id })
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.role, 'owner')));

    if (owners.length <= 1) {
      throw new Error('CANNOT_REMOVE_SOLE_OWNER');
    }
  }

  const [deleted] = await db
    .delete(workspaceMember)
    .where(eq(workspaceMember.id, memberId))
    .returning();

  return deleted;
}

export async function updateWorkspace(workspaceId: string, input: { name?: string }) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();

  if (Object.keys(updateData).length === 0) {
    return getWorkspaceById(workspaceId);
  }

  const [updated] = await db
    .update(workspace)
    .set(updateData)
    .where(eq(workspace.id, workspaceId))
    .returning();

  return updated ?? null;
}

export async function resolveWorkspace(userId: string, headerWorkspaceId?: string) {
  if (headerWorkspaceId) {
    const ws = await getWorkspaceById(headerWorkspaceId);
    if (!ws) return null;

    const membership = await getWorkspaceMembership(headerWorkspaceId, userId);
    if (!membership) return null;

    return ws;
  }

  const userWorkspaces = await getUserWorkspaces(userId);

  if (userWorkspaces.length === 0) {
    return null;
  }

  if (userWorkspaces.length === 1) {
    return userWorkspaces[0].workspace;
  }

  if (env.QUAYNT_EDITION === 'community') {
    return userWorkspaces[0].workspace;
  }

  return null;
}
