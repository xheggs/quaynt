import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { workspace, workspaceMember } from './workspace.schema';

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

export async function createWorkspaceForUser(userId: string, name: string, slug: string) {
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspace).values({ name, slug, ownerId: userId }).returning();

    await tx.insert(workspaceMember).values({
      workspaceId: ws.id,
      userId,
      role: 'owner',
    });

    return ws;
  });
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
