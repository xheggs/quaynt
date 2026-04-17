import { apiFetch } from '@/lib/query/fetch';

export interface GscConnection {
  id: string;
  workspaceId: string;
  propertyUrl: string;
  scope: string;
  status: 'active' | 'reauth_required' | 'forbidden' | 'revoked';
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: 'completed' | 'failed' | 'throttled' | null;
  lastSyncError: string | null;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export function listGscConnections() {
  return apiFetch<{ connections: GscConnection[] }>('/integrations/gsc/connections');
}

export function startGscOauth() {
  return apiFetch<{ authUrl: string; state: string }>('/integrations/gsc/oauth/start');
}

export function getPendingGscOauth() {
  return apiFetch<{ sites: GscSite[] }>('/integrations/gsc/oauth/pending');
}

export function confirmGscConnection(propertyUrl: string) {
  return apiFetch<{ connection: GscConnection }>('/integrations/gsc/connections', {
    method: 'POST',
    body: { propertyUrl },
  });
}

export function deleteGscConnection(connectionId: string) {
  return apiFetch<void>(`/integrations/gsc/connections/${connectionId}`, {
    method: 'DELETE',
  });
}
