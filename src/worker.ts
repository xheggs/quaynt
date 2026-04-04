import { PgBoss } from 'pg-boss';
import { registerHandlers } from './lib/jobs/handlers.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const boss = new PgBoss({
  connectionString,
  supervise: true,
  schedule: true,
  migrate: true,
});

boss.on('error', (error: Error) => {
  console.error('pg-boss worker error:', error);
});

async function start() {
  await boss.start();
  await registerHandlers(boss);
  console.log('Worker started');
}

async function shutdown() {
  console.log('Worker shutting down...');
  await boss.stop({ graceful: true });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
