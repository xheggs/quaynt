// ---------------------------------------------------------------------------
// GSC connection service — CRUD over `gsc_connection` rows.
//
// Encryption policy:
//   - Access and refresh tokens are AES-256-GCM encrypted on write.
//   - Tokens are decrypted only inside the GSC client at request time.
//   - Public-facing read paths (`listConnections`, `getConnectionPublic`) NEVER
//     return token material.
// ---------------------------------------------------------------------------

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { encryptCredential, decryptCredential } from '@/modules/adapters/adapter.crypto';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';
import { gscConnection } from './gsc-connection.schema';
import { revokeToken } from './gsc-oauth.service';

export type GscConnectionStatus = 'active' | 'reauth_required' | 'forbidden' | 'revoked';
export type GscSyncStatus = 'completed' | 'failed' | 'throttled';

export interface GscConnectionPublic {
  id: string;
  workspaceId: string;
  propertyUrl: string;
  scope: string;
  status: GscConnectionStatus;
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncStatus: GscSyncStatus | null;
  lastSyncError: string | null;
}

interface CreateConnectionInput {
  workspaceId: string;
  propertyUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
}

export interface ConnectionWithTokens {
  id: string;
  workspaceId: string;
  propertyUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
  status: GscConnectionStatus;
}

function toPublic(row: typeof gscConnection.$inferSelect): GscConnectionPublic {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    propertyUrl: row.propertyUrl,
    scope: row.scope,
    status: row.status as GscConnectionStatus,
    connectedAt: row.connectedAt,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus as GscSyncStatus | null,
    lastSyncError: row.lastSyncError,
  };
}

export async function createConnection(input: CreateConnectionInput): Promise<GscConnectionPublic> {
  const [row] = await db
    .insert(gscConnection)
    .values({
      workspaceId: input.workspaceId,
      propertyUrl: input.propertyUrl,
      accessTokenEncrypted: encryptCredential(input.accessToken),
      refreshTokenEncrypted: encryptCredential(input.refreshToken),
      tokenExpiresAt: input.tokenExpiresAt,
      scope: input.scope,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [gscConnection.workspaceId, gscConnection.propertyUrl],
      set: {
        accessTokenEncrypted: encryptCredential(input.accessToken),
        refreshTokenEncrypted: encryptCredential(input.refreshToken),
        tokenExpiresAt: input.tokenExpiresAt,
        scope: input.scope,
        status: 'active',
        lastSyncError: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toPublic(row);
}

export async function listConnections(workspaceId: string): Promise<GscConnectionPublic[]> {
  const rows = await db
    .select()
    .from(gscConnection)
    .where(eq(gscConnection.workspaceId, workspaceId));
  return rows.map(toPublic);
}

export async function getConnectionPublic(
  workspaceId: string,
  connectionId: string
): Promise<GscConnectionPublic | null> {
  const [row] = await db
    .select()
    .from(gscConnection)
    .where(and(eq(gscConnection.id, connectionId), eq(gscConnection.workspaceId, workspaceId)))
    .limit(1);
  return row ? toPublic(row) : null;
}

/**
 * Internal-only — returns decrypted tokens. Never use in API responses.
 */
export async function getConnectionWithTokens(
  connectionId: string
): Promise<ConnectionWithTokens | null> {
  const [row] = await db
    .select()
    .from(gscConnection)
    .where(eq(gscConnection.id, connectionId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    propertyUrl: row.propertyUrl,
    accessToken: decryptCredential(row.accessTokenEncrypted as EncryptedValue),
    refreshToken: decryptCredential(row.refreshTokenEncrypted as EncryptedValue),
    tokenExpiresAt: row.tokenExpiresAt,
    scope: row.scope,
    status: row.status as GscConnectionStatus,
  };
}

export async function updateAccessToken(
  connectionId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  await db
    .update(gscConnection)
    .set({
      accessTokenEncrypted: encryptCredential(accessToken),
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(gscConnection.id, connectionId));
}

export async function updateConnectionStatus(
  connectionId: string,
  status: GscConnectionStatus,
  error?: string
): Promise<void> {
  await db
    .update(gscConnection)
    .set({
      status,
      lastSyncError: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(gscConnection.id, connectionId));
}

export async function updateSyncResult(
  connectionId: string,
  syncStatus: GscSyncStatus,
  error: string | null = null
): Promise<void> {
  await db
    .update(gscConnection)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: syncStatus,
      lastSyncError: error,
      updatedAt: new Date(),
    })
    .where(eq(gscConnection.id, connectionId));
}

/**
 * Delete a connection. Attempts to revoke the refresh token at Google first,
 * then removes the DB row (which cascades to gsc_query_performance).
 *
 * Returns `true` if the row existed and was deleted; `false` otherwise.
 */
export async function deleteConnection(
  workspaceId: string,
  connectionId: string
): Promise<boolean> {
  const connection = await getConnectionWithTokens(connectionId);
  if (!connection || connection.workspaceId !== workspaceId) {
    return false;
  }

  try {
    await revokeToken(connection.refreshToken);
  } catch {
    // Token may already be invalid at Google's end; proceed with deletion.
  }

  const result = await db
    .delete(gscConnection)
    .where(and(eq(gscConnection.id, connectionId), eq(gscConnection.workspaceId, workspaceId)))
    .returning({ id: gscConnection.id });

  return result.length > 0;
}
