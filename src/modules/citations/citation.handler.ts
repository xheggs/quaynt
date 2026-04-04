import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { extractCitationsForModelRun } from './citation.pipeline';
import type { CitationExtractJobData } from './citation.types';

export async function registerCitationHandlers(boss: PgBoss): Promise<void> {
  await boss.work<CitationExtractJobData>(
    'citation-extract',
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { runId, workspaceId } = job.data;
        const log = logger.child({ jobId: job.id, runId, workspaceId });

        log.info('Processing citation extraction job');
        await extractCitationsForModelRun(runId, workspaceId, boss);
      }
    }
  );
}
