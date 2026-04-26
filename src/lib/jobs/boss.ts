import { PgBoss } from 'pg-boss';

let bossInstance: PgBoss | null = null;

export function createBoss(options?: {
  connectionString?: string;
  supervise?: boolean;
  schedule?: boolean;
}): PgBoss {
  if (bossInstance) return bossInstance;

  const connectionString = options?.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for pg-boss');
  }

  bossInstance = new PgBoss({
    connectionString,
    supervise: options?.supervise ?? false,
    schedule: options?.schedule ?? false,
  });

  bossInstance.on('error', (error: Error) => {
    console.error('pg-boss error:', error);
  });

  // pg-boss v12 requires start() before send/work/schedule, and queues to
  // be created before use. Wrap those methods so callers don't need to
  // remember either. start() is idempotent (no-op once started); createQueue
  // uses ON CONFLICT DO NOTHING so repeat calls are safe.
  applyAutoStartAndQueueCreate(bossInstance);

  return bossInstance;
}

export function applyAutoStartAndQueueCreate(boss: PgBoss): void {
  let startPromise: Promise<unknown> | null = null;
  const ensureStarted = (): Promise<unknown> => {
    if (!startPromise) {
      startPromise = boss.start().catch((err) => {
        startPromise = null;
        throw err;
      });
    }
    return startPromise;
  };

  const ensured = new Map<string, Promise<void>>();
  const ensureQueue = (name: string): Promise<void> => {
    let pending = ensured.get(name);
    if (!pending) {
      pending = boss.createQueue(name).catch((err) => {
        ensured.delete(name);
        throw err;
      });
      ensured.set(name, pending);
    }
    return pending;
  };

  for (const method of ['send', 'work', 'schedule'] as const) {
    const original = boss[method].bind(boss) as (...args: unknown[]) => Promise<unknown>;
    (boss as unknown as Record<string, unknown>)[method] = async (
      name: string,
      ...rest: unknown[]
    ) => {
      await ensureStarted();
      await ensureQueue(name);
      return original(name, ...rest);
    };
  }
}

/** @deprecated Use {@link applyAutoStartAndQueueCreate}. Kept for callers that
 * already manage `start()` themselves (e.g. the dedicated worker process). */
export const applyQueueAutoCreate = applyAutoStartAndQueueCreate;
