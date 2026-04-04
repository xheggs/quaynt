import { createHash, randomBytes } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig } from '@/lib/db/query-helpers';
import { countTotal } from '@/lib/db/query-helpers';
import { apiKey } from './api-key.schema';
import type { ApiKeyScope } from '@/lib/api/types';

const KEY_PREFIX = 'qk_';
const KEY_RANDOM_BYTES = 20;

function hashKey(plaintextKey: string): string {
  return createHash('sha256').update(plaintextKey).digest('hex');
}

function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('hex')}`;
}

export async function generateApiKey(
  workspaceId: string,
  name: string,
  scope: ApiKeyScope,
  expiresAt?: Date
) {
  const plaintextKey = generatePlaintextKey();
  const keyHash = hashKey(plaintextKey);
  const keyPrefix = plaintextKey.slice(0, 11);

  const [created] = await db
    .insert(apiKey)
    .values({
      workspaceId,
      name,
      keyHash,
      keyPrefix,
      scopes: scope,
      expiresAt: expiresAt ?? null,
    })
    .returning({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });

  return { ...created, key: plaintextKey };
}

export async function verifyApiKey(plaintextKey: string) {
  if (!plaintextKey.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashKey(plaintextKey);

  const [record] = await db
    .select({
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.keyHash, keyHash))
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.revokedAt) {
    return null;
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  await db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.keyHash, keyHash));

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    scopes: record.scopes,
  };
}

const API_KEY_SORT_COLUMNS = {
  createdAt: apiKey.createdAt,
  name: apiKey.name,
};

export const API_KEY_ALLOWED_SORTS = Object.keys(API_KEY_SORT_COLUMNS);

export async function listApiKeys(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions = [eq(apiKey.workspaceId, workspaceId), isNull(apiKey.revokedAt)];
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, API_KEY_SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      })
      .from(apiKey)
      .where(and(...conditions))
      .orderBy(orderBy ?? apiKey.createdAt)
      .limit(limit)
      .offset(offset),
    countTotal(apiKey, conditions),
  ]);

  return { items, total };
}

export async function getApiKey(keyId: string, workspaceId: string) {
  const [record] = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .where(and(eq(apiKey.id, keyId), eq(apiKey.workspaceId, workspaceId)))
    .limit(1);

  return record ?? null;
}

export async function revokeApiKey(keyId: string, workspaceId: string) {
  const result = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.id, keyId), eq(apiKey.workspaceId, workspaceId)))
    .returning({ id: apiKey.id });

  return result.length > 0;
}
