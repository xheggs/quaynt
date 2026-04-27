/**
 * Admin-only seed script: configure OpenRouter for a workspace.
 *
 * Usage:
 *
 *   OPENROUTER_API_KEY=sk-or-v1-... pnpm tsx scripts/seed-openrouter.ts \
 *     --workspace <workspace-id>
 *
 * Optional flags:
 *
 *   --workspace <id>      Target workspace ID. If omitted and exactly one
 *                         workspace exists, that one is used; otherwise the
 *                         script lists workspaces and exits.
 *   --enable <ids>        Comma-separated virtual platform IDs to enable
 *                         (default: all OR-virtual platforms).
 *   --monthly-cap <n>     Set or update the monthly token budget on the
 *                         shared openrouter row.
 *
 * Idempotent: re-running updates the encrypted API key on the credential
 * row and creates any missing virtual-platform rows. Existing virtual rows
 * are not overwritten — operators can edit display name and per-row config
 * (e.g. `orModel` overrides) in the UI.
 *
 * Free models on OpenRouter rotate frequently. Operators can override the
 * underlying model per workspace by setting `config.orModel` on the adapter
 * row (UI: Settings → Adapters → Edit). The default for `openrouter-free`
 * is OR's `openrouter/free` auto-router, which always picks something free.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { encryptCredential, decryptCredential } from '@/modules/adapters/adapter.crypto';
import { platformAdapter } from '@/modules/adapters/adapter.schema';
import { getAdapterRegistry } from '@/modules/adapters';
import { OPENROUTER_CREDENTIAL_PLATFORM_ID } from '@/modules/adapters/openrouter';
import { workspace } from '@/modules/workspace/workspace.schema';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';

interface Args {
  workspaceId?: string;
  enableIds?: string[];
  monthlyCap?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace' || a === '-w') {
      args.workspaceId = argv[++i];
    } else if (a?.startsWith('--workspace=')) {
      args.workspaceId = a.slice('--workspace='.length);
    } else if (a === '--enable') {
      args.enableIds = argv[++i]
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a?.startsWith('--enable=')) {
      args.enableIds = a
        .slice('--enable='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--monthly-cap') {
      args.monthlyCap = Number(argv[++i]);
    } else if (a?.startsWith('--monthly-cap=')) {
      args.monthlyCap = Number(a.slice('--monthly-cap='.length));
    }
  }
  return args;
}

function hasCredentials(value: unknown): value is EncryptedValue {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return 'ciphertext' in obj && 'iv' in obj && 'tag' in obj;
}

async function resolveWorkspaceId(provided?: string): Promise<string> {
  if (provided) {
    const [row] = await db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.id, provided))
      .limit(1);
    if (!row) {
      throw new Error(`Workspace "${provided}" not found.`);
    }
    return row.id;
  }

  const all = await db.select({ id: workspace.id, name: workspace.name }).from(workspace);
  if (all.length === 1) return all[0]!.id;

  console.error(
    all.length === 0
      ? 'No workspaces found. Run `pnpm db:seed` first or create one in the app.'
      : `Multiple workspaces — pass --workspace <id>:\n${all.map((w) => `  ${w.id}  ${w.name}`).join('\n')}`
  );
  process.exit(1);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'seed-openrouter is intended for local/dev setup. Refusing to run in production.'
    );
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('Set OPENROUTER_API_KEY in the environment before running this script.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const workspaceId = await resolveWorkspaceId(args.workspaceId);

  const registry = getAdapterRegistry();

  // Identify all virtual platforms whose credentialSource points at the
  // OpenRouter credential row. New OR-virtuals registered later are picked
  // up automatically — no need to update the script when the catalogue grows.
  const virtualPlatforms = registry
    .getRegisteredPlatforms()
    .filter((p) => p.credentialSource === OPENROUTER_CREDENTIAL_PLATFORM_ID);

  const enableSet = args.enableIds && args.enableIds.length > 0 ? new Set(args.enableIds) : null;

  // ---- 1. Upsert the shared credential row -------------------------------
  const encryptedCreds = encryptCredential(JSON.stringify({ apiKey }));

  const [existingShared] = await db
    .select({
      id: platformAdapter.id,
      credentials: platformAdapter.credentials,
      config: platformAdapter.config,
    })
    .from(platformAdapter)
    .where(
      and(
        eq(platformAdapter.workspaceId, workspaceId),
        eq(platformAdapter.platformId, OPENROUTER_CREDENTIAL_PLATFORM_ID),
        isNull(platformAdapter.deletedAt)
      )
    )
    .limit(1);

  let sharedConfigUpdate: Record<string, unknown> | undefined;
  if (args.monthlyCap !== undefined) {
    if (!Number.isFinite(args.monthlyCap) || args.monthlyCap < 0) {
      console.error('--monthly-cap must be a non-negative number.');
      process.exit(1);
    }
    const baseConfig = (existingShared?.config as Record<string, unknown> | undefined) ?? {};
    sharedConfigUpdate = {
      ...baseConfig,
      ...(args.monthlyCap === 0
        ? Object.fromEntries(Object.entries(baseConfig).filter(([k]) => k !== 'monthlyTokenCap'))
        : { monthlyTokenCap: Math.floor(args.monthlyCap) }),
    };
  }

  if (existingShared) {
    await db
      .update(platformAdapter)
      .set({
        credentials: encryptedCreds,
        ...(sharedConfigUpdate !== undefined && { config: sharedConfigUpdate }),
      })
      .where(eq(platformAdapter.id, existingShared.id));
    const verify = decryptCredential(encryptedCreds); // sanity round-trip
    if (!verify.includes('apiKey')) throw new Error('Round-trip credential check failed.');
    console.log(`Updated shared OpenRouter credential row (${existingShared.id}).`);
  } else {
    const [created] = await db
      .insert(platformAdapter)
      .values({
        workspaceId,
        platformId: OPENROUTER_CREDENTIAL_PLATFORM_ID,
        displayName: 'OpenRouter',
        credentials: encryptedCreds,
        config: sharedConfigUpdate ?? {},
        enabled: true,
      })
      .returning({ id: platformAdapter.id });
    console.log(`Created shared OpenRouter credential row (${created!.id}).`);
  }

  // ---- 2. Create one adapter row per virtual platform --------------------
  let createdCount = 0;
  let skippedCount = 0;
  const skippedDetail: string[] = [];

  for (const meta of virtualPlatforms) {
    if (enableSet && !enableSet.has(meta.platformId)) {
      skippedCount += 1;
      skippedDetail.push(`${meta.platformId} (not in --enable list)`);
      continue;
    }

    const [existing] = await db
      .select({ id: platformAdapter.id })
      .from(platformAdapter)
      .where(
        and(
          eq(platformAdapter.workspaceId, workspaceId),
          eq(platformAdapter.platformId, meta.platformId),
          isNull(platformAdapter.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      skippedCount += 1;
      skippedDetail.push(`${meta.platformId} (already exists)`);
      continue;
    }

    const [created] = await db
      .insert(platformAdapter)
      .values({
        workspaceId,
        platformId: meta.platformId,
        displayName: meta.displayName,
        credentials: {}, // shared via credentialSource indirection
        config: {},
        enabled: true,
      })
      .returning({ id: platformAdapter.id });
    createdCount += 1;
    console.log(`  + ${meta.platformId} → ${created!.id}`);
  }

  console.log(`\nDone. Created ${createdCount} virtual-platform row(s); skipped ${skippedCount}.`);
  if (skippedDetail.length > 0) {
    for (const line of skippedDetail) console.log(`  - ${line}`);
  }
  console.log(
    `\nUI: Settings → Adapters. To override a model per row, edit the adapter\n` +
      `and set "orModel" in its config (e.g. for openrouter-free, swap the\n` +
      `auto-router for a specific :free slug while it lasts).`
  );

  if (hasCredentials(encryptedCreds)) {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('seed-openrouter failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
