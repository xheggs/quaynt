import type { NextRequest, NextResponse } from 'next/server';

export type ApiKeyScope = 'read' | 'read-write' | 'admin';

export type AuthMethod = 'session' | 'api-key';

export type SessionAuthContext = {
  method: 'session';
  userId: string;
  sessionId: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
};

export type ApiKeyAuthContext = {
  method: 'api-key';
  userId: null;
  apiKeyId: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
};

export type AuthContext = SessionAuthContext | ApiKeyAuthContext;

export type RouteContext<T = Record<string, string>> = {
  params: Promise<T>;
};

export type ApiHandler<T = Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<T>
) => Promise<NextResponse>;

export type AuthenticatedHandler<T = Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<T>
) => Promise<NextResponse>;
