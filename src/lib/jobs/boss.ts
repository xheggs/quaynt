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

  return bossInstance;
}
