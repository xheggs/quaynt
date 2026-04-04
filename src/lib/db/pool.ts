import pg from 'pg';
import { env } from '@/lib/config/env';

const globalForPool = globalThis as unknown as { pgPool: pg.Pool | undefined };

export const pool: pg.Pool =
  globalForPool.pgPool ??
  new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 3,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pgPool = pool;
}
