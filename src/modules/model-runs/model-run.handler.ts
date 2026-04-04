import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { executeModelRun, executeModelRunQuery, checkStaleRuns } from './model-run.orchestrator';

export interface ModelRunExecuteJobData {
  runId: string;
  workspaceId: string;
}

export interface ModelRunQueryJobData {
  resultId: string;
  runId: string;
  workspaceId: string;
  promptId: string;
  adapterConfigId: string;
  interpolatedPrompt: string;
  locale: string | null;
}

export async function registerModelRunHandlers(boss: PgBoss): Promise<void> {
  // Coordinator handler — lightweight, low concurrency
  await boss.work<ModelRunExecuteJobData>(
    'model-run-execute',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { runId, workspaceId } = job.data;
        const log = logger.child({ jobId: job.id, runId, workspaceId });

        log.info('Processing model run coordinator job');
        await executeModelRun(runId, workspaceId, boss);
      }
    }
  );

  // Worker handler — I/O-bound, capped at 5 concurrent
  await boss.work<ModelRunQueryJobData>(
    'model-run-query',
    { includeMetadata: true, localConcurrency: 5 },
    async (jobs) => {
      for (const job of jobs) {
        const {
          resultId,
          runId,
          workspaceId,
          promptId,
          adapterConfigId,
          interpolatedPrompt,
          locale,
        } = job.data;

        const log = logger.child({ jobId: job.id, resultId, runId });
        log.info('Processing model run query job');

        await executeModelRunQuery(
          resultId,
          runId,
          workspaceId,
          promptId,
          adapterConfigId,
          interpolatedPrompt,
          locale,
          boss
        );
      }
    }
  );

  // Stale run monitor — every 5 minutes
  await boss.schedule('model-run-stale-check', '*/5 * * * *', {});
  await boss.work(
    'model-run-stale-check',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await checkStaleRuns(boss);
    }
  );
}
