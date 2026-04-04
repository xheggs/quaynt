import type { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/modules/auth/auth.config';
import { verifyApiKey } from '@/modules/workspace/api-key.service';
import {
  resolveWorkspace,
  createWorkspaceForUser,
  generateWorkspaceSlug,
  getUserWorkspaces,
} from '@/modules/workspace/workspace.service';
import { unauthorized, forbidden, badRequest } from './response';
import type { AuthContext, ApiKeyScope, AuthenticatedHandler } from './types';

const authContextMap = new WeakMap<Request, AuthContext>();

export function getAuthContext(req: Request): AuthContext {
  const ctx = authContextMap.get(req);
  if (!ctx) {
    throw new Error('Auth context not set — is the handler wrapped with withAuth?');
  }
  return ctx;
}

export function withAuth<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T>
) {
  return async (req: NextRequest, ctx: { params: Promise<T> }): Promise<NextResponse> => {
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer qk_')) {
      const token = authHeader.slice(7);
      const apiKeyRecord = await verifyApiKey(token);
      if (!apiKeyRecord) {
        return unauthorized();
      }

      const authCtx: AuthContext = {
        method: 'api-key',
        userId: null,
        apiKeyId: apiKeyRecord.id,
        workspaceId: apiKeyRecord.workspaceId,
        scopes: [apiKeyRecord.scopes],
      };

      authContextMap.set(req, authCtx);
      return handler(req, ctx);
    }

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return unauthorized();
    }

    const headerWorkspaceId = req.headers.get('x-workspace-id') ?? undefined;

    let resolved = await resolveWorkspace(session.user.id, headerWorkspaceId);

    if (!resolved) {
      const userWorkspaces = await getUserWorkspaces(session.user.id);

      if (userWorkspaces.length === 0) {
        const slug = generateWorkspaceSlug(session.user.name ?? session.user.email);
        const name = session.user.name ? `${session.user.name}'s Workspace` : 'My Workspace';

        console.warn(`[auth] Self-healing: creating default workspace for user ${session.user.id}`);
        resolved = await createWorkspaceForUser(session.user.id, name, slug);
      } else if (!headerWorkspaceId && userWorkspaces.length > 1) {
        return badRequest('A workspace context is required for this request');
      } else {
        return forbidden('You are not a member of this workspace');
      }
    }

    const authCtx: AuthContext = {
      method: 'session',
      userId: session.user.id,
      sessionId: session.session.id,
      workspaceId: resolved.id,
      scopes: ['admin'],
    };

    authContextMap.set(req, authCtx);
    return handler(req, ctx);
  };
}

const SCOPE_LEVELS: Record<ApiKeyScope, number> = {
  read: 0,
  'read-write': 1,
  admin: 2,
};

function hasScope(granted: ApiKeyScope[], required: ApiKeyScope): boolean {
  const requiredLevel = SCOPE_LEVELS[required];
  return granted.some((s) => SCOPE_LEVELS[s] >= requiredLevel);
}

export function withScope<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T>,
  requiredScope: ApiKeyScope
) {
  const wrapped: AuthenticatedHandler<T> = async (req, ctx) => {
    const authCtx = getAuthContext(req);

    if (!hasScope(authCtx.scopes, requiredScope)) {
      return forbidden('This API key does not have permission for this action');
    }

    return handler(req, ctx);
  };
  return wrapped;
}
