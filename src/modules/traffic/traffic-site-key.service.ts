import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { trafficSiteKey } from './traffic-site-key.schema';

const KEY_PREFIX = 'tsk_';
const KEY_RANDOM_BYTES = 16; // 32 hex chars → total plaintext length 36

function hashKey(plaintextKey: string): string {
  return createHash('sha256').update(plaintextKey).digest('hex');
}

function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('hex')}`;
}

function normalizeOrigins(origins: string[] | undefined): string[] {
  if (!origins) return [];
  return origins
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .map((o) => o.replace(/\/$/, '')); // strip trailing slash for consistent comparison
}

/**
 * In-memory debounce state for `lastUsedAt` writes. The collector can run at thousands
 * of requests per second per key, but recording last-used timing at second-level
 * granularity serves no product purpose — we debounce to at most one write per 60s per
 * key to avoid write amplification.
 *
 * This state is per-process and is reset on restart. That is acceptable: the debounce
 * is a bookkeeping optimization, not a correctness mechanism.
 */
const DEBOUNCE_WINDOW_MS = 60_000;
const lastUsedDebounce = new Map<string, number>();

/** Test-only: reset the in-memory debounce state. */
export function __resetDebounceForTests(): void {
  lastUsedDebounce.clear();
}

export interface CreateSiteKeyInput {
  workspaceId: string;
  name: string;
  allowedOrigins?: string[];
}

export async function createSiteKey(input: CreateSiteKeyInput) {
  const plaintextKey = generatePlaintextKey();
  const keyHash = hashKey(plaintextKey);
  const keyPrefix = plaintextKey.slice(0, 11); // "tsk_" + 7 hex chars
  const allowedOrigins = normalizeOrigins(input.allowedOrigins);

  const [created] = await db
    .insert(trafficSiteKey)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      keyHash,
      keyPrefix,
      allowedOrigins,
    })
    .returning({
      id: trafficSiteKey.id,
      name: trafficSiteKey.name,
      keyPrefix: trafficSiteKey.keyPrefix,
      status: trafficSiteKey.status,
      allowedOrigins: trafficSiteKey.allowedOrigins,
      createdAt: trafficSiteKey.createdAt,
    });

  return { ...created, plaintextKey };
}

const SITE_KEY_SORT_COLUMNS = {
  createdAt: trafficSiteKey.createdAt,
  name: trafficSiteKey.name,
  lastUsedAt: trafficSiteKey.lastUsedAt,
};

export const SITE_KEY_ALLOWED_SORTS = Object.keys(SITE_KEY_SORT_COLUMNS);

export async function listSiteKeys(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions = [eq(trafficSiteKey.workspaceId, workspaceId)];
  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SITE_KEY_SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: trafficSiteKey.id,
        name: trafficSiteKey.name,
        keyPrefix: trafficSiteKey.keyPrefix,
        status: trafficSiteKey.status,
        allowedOrigins: trafficSiteKey.allowedOrigins,
        lastUsedAt: trafficSiteKey.lastUsedAt,
        createdAt: trafficSiteKey.createdAt,
        revokedAt: trafficSiteKey.revokedAt,
      })
      .from(trafficSiteKey)
      .where(and(...conditions))
      .orderBy(orderBy ?? trafficSiteKey.createdAt)
      .limit(limit)
      .offset(offset),
    countTotal(trafficSiteKey, conditions),
  ]);

  return { items, total };
}

export async function getSiteKey(workspaceId: string, siteKeyId: string) {
  const [record] = await db
    .select({
      id: trafficSiteKey.id,
      name: trafficSiteKey.name,
      keyPrefix: trafficSiteKey.keyPrefix,
      status: trafficSiteKey.status,
      allowedOrigins: trafficSiteKey.allowedOrigins,
      lastUsedAt: trafficSiteKey.lastUsedAt,
      createdAt: trafficSiteKey.createdAt,
      revokedAt: trafficSiteKey.revokedAt,
    })
    .from(trafficSiteKey)
    .where(and(eq(trafficSiteKey.id, siteKeyId), eq(trafficSiteKey.workspaceId, workspaceId)))
    .limit(1);

  return record ?? null;
}

export interface UpdateSiteKeyInput {
  name?: string;
  allowedOrigins?: string[];
}

export async function updateSiteKey(
  workspaceId: string,
  siteKeyId: string,
  input: UpdateSiteKeyInput
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.allowedOrigins !== undefined)
    patch.allowedOrigins = normalizeOrigins(input.allowedOrigins);
  if (Object.keys(patch).length === 0) return getSiteKey(workspaceId, siteKeyId);

  const [record] = await db
    .update(trafficSiteKey)
    .set(patch)
    .where(and(eq(trafficSiteKey.id, siteKeyId), eq(trafficSiteKey.workspaceId, workspaceId)))
    .returning({
      id: trafficSiteKey.id,
      name: trafficSiteKey.name,
      keyPrefix: trafficSiteKey.keyPrefix,
      status: trafficSiteKey.status,
      allowedOrigins: trafficSiteKey.allowedOrigins,
      lastUsedAt: trafficSiteKey.lastUsedAt,
      createdAt: trafficSiteKey.createdAt,
      revokedAt: trafficSiteKey.revokedAt,
    });

  return record ?? null;
}

export async function revokeSiteKey(workspaceId: string, siteKeyId: string) {
  const [record] = await db
    .update(trafficSiteKey)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(and(eq(trafficSiteKey.id, siteKeyId), eq(trafficSiteKey.workspaceId, workspaceId)))
    .returning({ id: trafficSiteKey.id });

  return record !== undefined;
}

/**
 * Resolves a plaintext site key to its workspace and allowedOrigins. Returns null for
 * unknown, revoked, or malformed keys. Updates `lastUsedAt` at most once per 60s per key
 * via in-memory debounce (see DEBOUNCE_WINDOW_MS).
 */
export async function getSiteKeyByPlaintext(plaintextKey: string) {
  if (!plaintextKey.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashKey(plaintextKey);

  const [record] = await db
    .select({
      id: trafficSiteKey.id,
      workspaceId: trafficSiteKey.workspaceId,
      status: trafficSiteKey.status,
      allowedOrigins: trafficSiteKey.allowedOrigins,
    })
    .from(trafficSiteKey)
    .where(eq(trafficSiteKey.keyHash, keyHash))
    .limit(1);

  if (!record) return null;
  if (record.status !== 'active') return null;

  const now = Date.now();
  const lastWrite = lastUsedDebounce.get(record.id) ?? 0;
  if (now - lastWrite > DEBOUNCE_WINDOW_MS) {
    lastUsedDebounce.set(record.id, now);
    // Fire-and-forget — a failed bookkeeping update must never interrupt ingest.
    void (async () => {
      try {
        await db
          .update(trafficSiteKey)
          .set({ lastUsedAt: new Date() })
          .where(eq(trafficSiteKey.id, record.id));
      } catch {
        // swallow — debounce bookkeeping is not correctness-critical
      }
    })();
  }

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    allowedOrigins: record.allowedOrigins,
  };
}
