import { eq, and, desc, isNull } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { platformAdapter } from './adapter.schema';
import { encryptCredential, decryptCredential } from './adapter.crypto';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import type { AdapterRegistry } from './adapter.registry';
import type { EncryptedValue, HealthStatusValue } from './adapter.types';

const SORT_COLUMNS = {
  createdAt: platformAdapter.createdAt,
  displayName: platformAdapter.displayName,
  platformId: platformAdapter.platformId,
};

export const ADAPTER_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

// -- Helpers ----------------------------------------------------------------

function hasCredentials(credentials: unknown): boolean {
  if (!credentials || typeof credentials !== 'object') return false;
  const obj = credentials as Record<string, unknown>;
  return 'ciphertext' in obj && 'iv' in obj && 'tag' in obj;
}

/**
 * Resolve decrypted credentials for an adapter record. When the platform's
 * metadata has `credentialSource`, looks up that platform's row in the same
 * workspace and uses its credentials instead — used for shared-credential
 * setups (e.g. several OpenRouter-backed virtual platforms reusing one
 * OpenRouter key). Returns `{}` when no credentials are configured.
 *
 * Throws when `credentialSource` is declared but no row exists for the
 * source platform — operators must configure the credential holder first.
 */
export async function resolveCredentialsForAdapter(
  record: {
    workspaceId: string;
    platformId: string;
    credentials: unknown;
  },
  registry: AdapterRegistry
): Promise<Record<string, unknown>> {
  const metadata = registry.getMetadata(record.platformId);
  const source = metadata?.credentialSource;

  if (source) {
    const [sourceRow] = await db
      .select({ credentials: platformAdapter.credentials })
      .from(platformAdapter)
      .where(
        and(
          eq(platformAdapter.workspaceId, record.workspaceId),
          eq(platformAdapter.platformId, source),
          isNull(platformAdapter.deletedAt)
        )
      )
      .limit(1);

    if (!sourceRow || !hasCredentials(sourceRow.credentials)) {
      throw new Error(
        `Adapter "${record.platformId}" requires shared credentials from "${source}" but none are configured in this workspace`
      );
    }

    return JSON.parse(decryptCredential(sourceRow.credentials as EncryptedValue));
  }

  return hasCredentials(record.credentials)
    ? JSON.parse(decryptCredential(record.credentials as EncryptedValue))
    : {};
}

function adapterConfigFields() {
  return {
    id: platformAdapter.id,
    workspaceId: platformAdapter.workspaceId,
    platformId: platformAdapter.platformId,
    displayName: platformAdapter.displayName,
    enabled: platformAdapter.enabled,
    config: platformAdapter.config,
    rateLimitPoints: platformAdapter.rateLimitPoints,
    rateLimitDuration: platformAdapter.rateLimitDuration,
    timeoutMs: platformAdapter.timeoutMs,
    maxRetries: platformAdapter.maxRetries,
    circuitBreakerThreshold: platformAdapter.circuitBreakerThreshold,
    circuitBreakerResetMs: platformAdapter.circuitBreakerResetMs,
    lastHealthStatus: platformAdapter.lastHealthStatus,
    lastHealthCheckedAt: platformAdapter.lastHealthCheckedAt,
    createdAt: platformAdapter.createdAt,
    updatedAt: platformAdapter.updatedAt,
  };
}

function toApiResponse<T extends Record<string, unknown>>(record: T) {
  const { credentials, ...rest } = record as T & { credentials?: unknown };
  return {
    ...rest,
    credentialsSet: hasCredentials(credentials),
  };
}

// -- CRUD -------------------------------------------------------------------

export async function createAdapterConfig(
  workspaceId: string,
  input: {
    platformId: string;
    displayName: string;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
    enabled?: boolean;
    rateLimitPoints?: number;
    rateLimitDuration?: number;
    timeoutMs?: number;
    maxRetries?: number;
    circuitBreakerThreshold?: number;
    circuitBreakerResetMs?: number;
  },
  registry: AdapterRegistry,
  boss?: PgBoss
) {
  // Validate platform is registered
  if (!registry.isRegistered(input.platformId)) {
    throw new Error(`Unknown platform: ${input.platformId}`);
  }

  // Validate credentials against platform schema
  const metadata = registry.getMetadata(input.platformId)!;
  if (input.credentials) {
    validateCredentials(input.credentials, metadata.credentialSchema);
  }

  // Check uniqueness
  const existing = await db
    .select({ id: platformAdapter.id })
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.workspaceId, workspaceId),
        eq(platformAdapter.platformId, input.platformId),
        isNull(platformAdapter.deletedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('An adapter for this platform already exists in this workspace');
  }

  // Encrypt credentials
  const encryptedCredentials = input.credentials
    ? encryptCredential(JSON.stringify(input.credentials))
    : {};

  const [created] = await db
    .insert(platformAdapter)
    .values({
      workspaceId,
      platformId: input.platformId,
      displayName: input.displayName,
      credentials: encryptedCredentials,
      config: input.config ?? {},
      enabled: input.enabled ?? true,
      rateLimitPoints: input.rateLimitPoints,
      rateLimitDuration: input.rateLimitDuration,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      circuitBreakerThreshold: input.circuitBreakerThreshold,
      circuitBreakerResetMs: input.circuitBreakerResetMs,
    })
    .returning({
      ...adapterConfigFields(),
      credentials: platformAdapter.credentials,
    });

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'adapter.health_changed',
      {
        adapter: {
          id: created.id,
          platformId: created.platformId,
          displayName: created.displayName,
        },
        previousStatus: null,
        currentStatus: null,
      },
      boss
    );
  }

  return toApiResponse(created);
}

export async function listAdapterConfigs(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions = [
    eq(platformAdapter.workspaceId, workspaceId),
    isNull(platformAdapter.deletedAt),
  ];

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        ...adapterConfigFields(),
        credentials: platformAdapter.credentials,
      })
      .from(platformAdapter)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(platformAdapter.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(platformAdapter, conditions),
  ]);

  return {
    items: items.map((item) => toApiResponse(item)),
    total,
  };
}

export async function getAdapterConfig(adapterId: string, workspaceId: string) {
  const [record] = await db
    .select({
      ...adapterConfigFields(),
      credentials: platformAdapter.credentials,
    })
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.id, adapterId),
        eq(platformAdapter.workspaceId, workspaceId),
        isNull(platformAdapter.deletedAt)
      )
    )
    .limit(1);

  if (!record) return null;
  return toApiResponse(record);
}

export async function updateAdapterConfig(
  adapterId: string,
  workspaceId: string,
  input: {
    displayName?: string;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
    enabled?: boolean;
    rateLimitPoints?: number;
    rateLimitDuration?: number;
    timeoutMs?: number;
    maxRetries?: number;
    circuitBreakerThreshold?: number;
    circuitBreakerResetMs?: number;
  },
  registry?: AdapterRegistry,
  boss?: PgBoss
) {
  const updateData: Record<string, unknown> = {};

  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.enabled !== undefined) updateData.enabled = input.enabled;
  if (input.config !== undefined) updateData.config = input.config;
  if (input.rateLimitPoints !== undefined) updateData.rateLimitPoints = input.rateLimitPoints;
  if (input.rateLimitDuration !== undefined) updateData.rateLimitDuration = input.rateLimitDuration;
  if (input.timeoutMs !== undefined) updateData.timeoutMs = input.timeoutMs;
  if (input.maxRetries !== undefined) updateData.maxRetries = input.maxRetries;
  if (input.circuitBreakerThreshold !== undefined)
    updateData.circuitBreakerThreshold = input.circuitBreakerThreshold;
  if (input.circuitBreakerResetMs !== undefined)
    updateData.circuitBreakerResetMs = input.circuitBreakerResetMs;

  if (input.credentials !== undefined) {
    // If registry provided, validate credentials against schema
    if (registry) {
      const [existing] = await db
        .select({ platformId: platformAdapter.platformId })
        .from(platformAdapter)
        .where(
          and(
            eq(platformAdapter.id, adapterId),
            eq(platformAdapter.workspaceId, workspaceId),
            isNull(platformAdapter.deletedAt)
          )
        )
        .limit(1);

      if (existing) {
        const metadata = registry.getMetadata(existing.platformId);
        if (metadata) {
          validateCredentials(input.credentials, metadata.credentialSchema);
        }
      }
    }

    updateData.credentials = encryptCredential(JSON.stringify(input.credentials));
  }

  const [updated] = await db
    .update(platformAdapter)
    .set(updateData)
    .where(
      and(
        eq(platformAdapter.id, adapterId),
        eq(platformAdapter.workspaceId, workspaceId),
        isNull(platformAdapter.deletedAt)
      )
    )
    .returning({
      ...adapterConfigFields(),
      credentials: platformAdapter.credentials,
    });

  if (!updated) return null;

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'adapter.health_changed',
      {
        adapter: {
          id: updated.id,
          platformId: updated.platformId,
          displayName: updated.displayName,
        },
      },
      boss
    );
  }

  return toApiResponse(updated);
}

export async function deleteAdapterConfig(adapterId: string, workspaceId: string, boss?: PgBoss) {
  const now = new Date();

  const [deleted] = await db
    .update(platformAdapter)
    .set({ deletedAt: now })
    .where(
      and(
        eq(platformAdapter.id, adapterId),
        eq(platformAdapter.workspaceId, workspaceId),
        isNull(platformAdapter.deletedAt)
      )
    )
    .returning({
      id: platformAdapter.id,
      platformId: platformAdapter.platformId,
      displayName: platformAdapter.displayName,
    });

  if (!deleted) return false;

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'adapter.health_changed',
      {
        adapter: { ...deleted, deletedAt: now.toISOString() },
      },
      boss
    );
  }

  return true;
}

export async function getAdapterHealth(
  adapterId: string,
  workspaceId: string,
  registry: AdapterRegistry,
  boss?: PgBoss
) {
  // Load full record including credentials for adapter instantiation
  const [record] = await db
    .select()
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.id, adapterId),
        eq(platformAdapter.workspaceId, workspaceId),
        isNull(platformAdapter.deletedAt)
      )
    )
    .limit(1);

  if (!record) return null;

  // Decrypt credentials (follows credentialSource indirection when set)
  const decryptedCredentials = await resolveCredentialsForAdapter(record, registry);

  // Create adapter instance
  const adapter = registry.createInstance(record.platformId, {
    id: record.id,
    workspaceId: record.workspaceId,
    platformId: record.platformId,
    displayName: record.displayName,
    enabled: record.enabled,
    credentials: decryptedCredentials,
    config: (record.config ?? {}) as Record<string, unknown>,
    rateLimitPoints: record.rateLimitPoints,
    rateLimitDuration: record.rateLimitDuration,
    timeoutMs: record.timeoutMs,
    maxRetries: record.maxRetries,
    circuitBreakerThreshold: record.circuitBreakerThreshold,
    circuitBreakerResetMs: record.circuitBreakerResetMs,
  });

  // Run health check
  const health = await adapter.healthCheck();
  const previousStatus = record.lastHealthStatus as HealthStatusValue | null;

  // Persist health status
  await db
    .update(platformAdapter)
    .set({
      lastHealthStatus: health.status,
      lastHealthCheckedAt: health.lastCheckedAt,
    })
    .where(eq(platformAdapter.id, adapterId));

  // Fire webhook on state transition
  if (boss && previousStatus !== null && previousStatus !== health.status) {
    await dispatchWebhookEvent(
      workspaceId,
      'adapter.health_changed',
      {
        adapter: {
          id: record.id,
          platformId: record.platformId,
          displayName: record.displayName,
        },
        previousStatus,
        currentStatus: health.status,
      },
      boss
    );
  }

  return health;
}

// -- Credential validation --------------------------------------------------

function validateCredentials(
  credentials: Record<string, unknown>,
  schema: { field: string; type: string; required: boolean }[]
): void {
  for (const fieldDef of schema) {
    const value = credentials[fieldDef.field];
    if (fieldDef.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Missing required credential field: ${fieldDef.field}`);
    }
    if (value !== undefined && value !== null) {
      const actualType = typeof value;
      if (actualType !== fieldDef.type) {
        throw new Error(
          `Credential field "${fieldDef.field}" must be of type ${fieldDef.type}, got ${actualType}`
        );
      }
    }
  }
}
