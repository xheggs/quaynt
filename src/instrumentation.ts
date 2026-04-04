export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DATABASE_URL) {
    const { createBoss } = await import('@/lib/jobs/boss');
    const boss = createBoss({ supervise: false, schedule: false });
    await boss.start();
  }
}
