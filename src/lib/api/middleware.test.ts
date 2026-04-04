// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockVerifyApiKey = vi.fn();
const mockResolveWorkspace = vi.fn();
const mockGetUserWorkspaces = vi.fn();
const mockCreateWorkspaceForUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/modules/workspace/api-key.service', () => ({
  verifyApiKey: (...args: unknown[]) => mockVerifyApiKey(...args),
}));

vi.mock('@/modules/workspace/workspace.service', () => ({
  resolveWorkspace: (...args: unknown[]) => mockResolveWorkspace(...args),
  getUserWorkspaces: (...args: unknown[]) => mockGetUserWorkspaces(...args),
  createWorkspaceForUser: (...args: unknown[]) => mockCreateWorkspaceForUser(...args),
  generateWorkspaceSlug: () => 'test-slug-abc123',
}));

vi.mock('@/modules/auth/auth.config', () => ({
  getAuth: () => ({
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  }),
}));

import { withAuth, withScope, getAuthContext } from './middleware';

function createRequest(options?: { authorization?: string; workspaceId?: string }): NextRequest {
  const headers = new Headers();
  if (options?.authorization) {
    headers.set('authorization', options.authorization);
  }
  if (options?.workspaceId) {
    headers.set('x-workspace-id', options.workspaceId);
  }
  return new NextRequest('http://localhost:3000/api/v1/test', { headers });
}

const mockCtx = { params: Promise.resolve({}) };

const echoHandler = async (req: NextRequest) => {
  const auth = getAuthContext(req);
  return new Response(JSON.stringify(auth), {
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse;
};

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no auth is provided', async () => {
    const handler = withAuth(echoHandler);
    const response = await handler(createRequest(), mockCtx);
    expect(response.status).toBe(401);
  });

  describe('API key auth', () => {
    it('authenticates with valid Bearer qk_ token', async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        id: 'key_123',
        workspaceId: 'ws_123',
        scopes: 'admin',
      });

      const handler = withAuth(echoHandler);
      const response = await handler(createRequest({ authorization: 'Bearer qk_abc123' }), mockCtx);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.method).toBe('api-key');
      expect(body.workspaceId).toBe('ws_123');
    });

    it('returns 401 for invalid API key', async () => {
      mockVerifyApiKey.mockResolvedValueOnce(null);

      const handler = withAuth(echoHandler);
      const response = await handler(
        createRequest({ authorization: 'Bearer qk_invalid' }),
        mockCtx
      );

      expect(response.status).toBe(401);
    });
  });

  describe('session auth', () => {
    it('authenticates with valid session cookie', async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'usr_123', name: 'Test', email: 'test@test.com' },
        session: { id: 'ses_123' },
      });
      mockResolveWorkspace.mockResolvedValueOnce({
        id: 'ws_123',
        name: 'Test Workspace',
      });

      const handler = withAuth(echoHandler);
      const response = await handler(createRequest(), mockCtx);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.method).toBe('session');
      expect(body.userId).toBe('usr_123');
      expect(body.workspaceId).toBe('ws_123');
      expect(body.scopes).toEqual(['admin']);
    });

    it('returns 401 when session is invalid', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const handler = withAuth(echoHandler);
      const response = await handler(createRequest(), mockCtx);

      expect(response.status).toBe(401);
    });

    it('self-heals when user has no workspaces', async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'usr_123', name: 'Test', email: 'test@test.com' },
        session: { id: 'ses_123' },
      });
      mockResolveWorkspace.mockResolvedValueOnce(null);
      mockGetUserWorkspaces.mockResolvedValueOnce([]);
      mockCreateWorkspaceForUser.mockResolvedValueOnce({
        id: 'ws_new',
        name: "Test's Workspace",
      });

      const handler = withAuth(echoHandler);
      const response = await handler(createRequest(), mockCtx);

      expect(response.status).toBe(200);
      expect(mockCreateWorkspaceForUser).toHaveBeenCalledOnce();
    });
  });
});

describe('withScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows admin scope to access read endpoints', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_123',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });

    const handler = withAuth(withScope(echoHandler, 'read'));
    const response = await handler(createRequest({ authorization: 'Bearer qk_test123' }), mockCtx);

    expect(response.status).toBe(200);
  });

  it('allows admin scope to access read-write endpoints', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_123',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });

    const handler = withAuth(withScope(echoHandler, 'read-write'));
    const response = await handler(createRequest({ authorization: 'Bearer qk_test123' }), mockCtx);

    expect(response.status).toBe(200);
  });

  it('denies read scope access to admin endpoints', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_123',
      workspaceId: 'ws_123',
      scopes: 'read',
    });

    const handler = withAuth(withScope(echoHandler, 'admin'));
    const response = await handler(createRequest({ authorization: 'Bearer qk_test123' }), mockCtx);

    expect(response.status).toBe(403);
  });

  it('denies read scope access to read-write endpoints', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_123',
      workspaceId: 'ws_123',
      scopes: 'read',
    });

    const handler = withAuth(withScope(echoHandler, 'read-write'));
    const response = await handler(createRequest({ authorization: 'Bearer qk_test123' }), mockCtx);

    expect(response.status).toBe(403);
  });

  it('allows session auth (implicit admin) to access all scopes', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'usr_123', name: 'Test', email: 'test@test.com' },
      session: { id: 'ses_123' },
    });
    mockResolveWorkspace.mockResolvedValueOnce({
      id: 'ws_123',
      name: 'Test',
    });

    const handler = withAuth(withScope(echoHandler, 'admin'));
    const response = await handler(createRequest(), mockCtx);

    expect(response.status).toBe(200);
  });
});
