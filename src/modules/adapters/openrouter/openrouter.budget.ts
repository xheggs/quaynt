import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';
import { platformAdapter } from '../adapter.schema';
import { PermanentAdapterError } from '../adapter.types';
import {
  OPENROUTER_CREDENTIAL_PLATFORM_ID,
  type OpenRouterPlatformConfig,
} from './openrouter.types';

/**
 * Optional monthly token budget enforced before each OpenRouter-backed
 * query. Reads `monthlyTokenCap` (number) from the workspace's `openrouter`
 * platform_adapter `config` JSONB. When set, sums `responseMetadata.tokensUsed`
 * across the workspace's OR-virtual platforms in the current calendar month
 * and refuses to dispatch a new query when the cap is exceeded.
 *
 * Lightweight by design — this is a circuit-breaker, not a metering system.
 * When unset (default), the helper is a no-op so existing flows are
 * unaffected.
 */

const VIRTUAL_PLATFORM_IDS_PLACEHOLDER: string[] = [];

/**
 * Set of OR-virtual platform IDs whose token usage counts toward the budget.
 * Populated lazily by the platforms registration to avoid a circular import
 * between platforms.ts and budget.ts.
 */
const virtualPlatformIds = new Set<string>(VIRTUAL_PLATFORM_IDS_PLACEHOLDER);

export function registerOpenRouterVirtualPlatformId(platformId: string): void {
  virtualPlatformIds.add(platformId);
}

export function getOpenRouterVirtualPlatformIds(): string[] {
  return Array.from(virtualPlatformIds);
}

export interface BudgetCheckOptions {
  workspaceId: string;
  platformId: string;
}

/**
 * Throws `PermanentAdapterError` when the workspace's monthly OR token cap
 * has been exceeded. Returns silently when no cap is configured. The cap
 * lives on the workspace's `openrouter` platform_adapter row's `config`
 * JSONB (`monthlyTokenCap`, integer); when absent the helper is a no-op.
 */
export async function assertWithinMonthlyBudget(
  options: BudgetCheckOptions,
  // Allow tests to inject a `now` clock without depending on the system date.
  now: Date = new Date()
): Promise<void> {
  const cap = await readMonthlyCap(options.workspaceId);
  if (cap === null) return;

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const platformIds = getOpenRouterVirtualPlatformIds();
  if (platformIds.length === 0) return;

  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM((${modelRunResult.responseMetadata}->>'tokensUsed')::int), 0)::int`,
    })
    .from(modelRunResult)
    .innerJoin(modelRun, eq(modelRunResult.modelRunId, modelRun.id))
    .where(
      and(
        eq(modelRun.workspaceId, options.workspaceId),
        inArray(modelRunResult.platformId, platformIds),
        gte(modelRunResult.createdAt, startOfMonth)
      )
    );

  const used = row?.total ?? 0;
  if (used >= cap) {
    throw new PermanentAdapterError(
      `OpenRouter monthly token budget exceeded (${used}/${cap}). Raise or remove "monthlyTokenCap" on the ${OPENROUTER_CREDENTIAL_PLATFORM_ID} adapter to continue.`,
      options.platformId
    );
  }
}

async function readMonthlyCap(workspaceId: string): Promise<number | null> {
  const [row] = await db
    .select({ config: platformAdapter.config })
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.workspaceId, workspaceId),
        eq(platformAdapter.platformId, OPENROUTER_CREDENTIAL_PLATFORM_ID),
        isNull(platformAdapter.deletedAt)
      )
    )
    .limit(1);

  const cfg = row?.config as Record<string, unknown> | undefined;
  if (!cfg) return null;
  const raw = cfg['monthlyTokenCap'];
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export type OpenRouterPlatformConfigForBudget = Pick<OpenRouterPlatformConfig, 'orModel'>;
