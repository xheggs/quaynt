import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { detectFormat, parseLine } from './crawler-log-parser';
import { identifyBot } from './crawler-bot-dictionary';
import {
  getUpload,
  getStagingPath,
  updateUploadStatus,
  deleteStagingFile,
} from './crawler-upload.service';
import { batchInsertVisits, getAffectedDates } from './crawler-visit.service';
import type { CrawlerParseJobData, VisitInsert, LogFormat } from './crawler.types';

const BATCH_SIZE = 500;
const STATUS_CHECK_INTERVAL = 10_000; // Check cancellation every 10k lines

const log = logger.child({ module: 'crawler-parse' });

export async function registerCrawlerParseHandler(boss: PgBoss): Promise<void> {
  await boss.work<CrawlerParseJobData>(
    'crawler-parse',
    { includeMetadata: true, localConcurrency: 2 },
    async (jobs) => {
      for (const job of jobs) {
        const { workspaceId, uploadId } = job.data;
        log.info({ jobId: job.id, uploadId, workspaceId }, 'Starting crawler log parse');
        await processUpload(workspaceId, uploadId, boss);
      }
    }
  );
}

async function processUpload(workspaceId: string, uploadId: string, boss: PgBoss): Promise<void> {
  // Check if upload was cancelled before starting
  const upload = await getUpload(workspaceId, uploadId);
  if (!upload || upload.status === 'cancelled') {
    log.info('Upload cancelled before processing started');
    await deleteStagingFile(workspaceId, uploadId);
    return;
  }

  const filePath = getStagingPath(workspaceId, uploadId);
  await updateUploadStatus(uploadId, 'processing');

  let linesTotal = 0;
  let linesParsed = 0;
  let linesSkipped = 0;
  let format: LogFormat | null = null;
  const visitBatch: VisitInsert[] = [];
  const formatDetectionLines: string[] = [];

  try {
    // Set up streaming: gunzip if .gz extension
    let inputStream: NodeJS.ReadableStream = createReadStream(filePath);
    if (upload.filename.endsWith('.gz')) {
      const gunzip = createGunzip();
      inputStream = inputStream.pipe(gunzip);
    }

    const rl = createInterface({ input: inputStream, crlfDelay: Infinity });

    for await (const line of rl) {
      linesTotal++;

      // Auto-detect format from first 5 non-empty lines
      if (!format) {
        if (line.trim().length > 0) {
          formatDetectionLines.push(line);
        }
        if (formatDetectionLines.length >= 5) {
          format = detectFormat(formatDetectionLines);
          if (!format) {
            await updateUploadStatus(uploadId, 'failed', {
              linesTotal,
              errorMessage: 'Could not detect log format',
            });
            await deleteStagingFile(workspaceId, uploadId);
            return;
          }

          // Re-process the detection lines
          for (const detectionLine of formatDetectionLines) {
            processLine(detectionLine, format, workspaceId, uploadId, visitBatch);
          }
          linesParsed += visitBatch.length;
          linesSkipped += formatDetectionLines.length - visitBatch.length;
        }
        continue;
      }

      // Parse line
      const before = visitBatch.length;
      processLine(line, format, workspaceId, uploadId, visitBatch);
      if (visitBatch.length > before) {
        linesParsed++;
      } else {
        linesSkipped++;
      }

      // Flush batch when full
      if (visitBatch.length >= BATCH_SIZE) {
        await batchInsertVisits(visitBatch.splice(0, visitBatch.length));
      }

      // Periodic status check + progress update
      if (linesTotal % STATUS_CHECK_INTERVAL === 0) {
        const current = await getUpload(workspaceId, uploadId);
        if (current?.status === 'cancelled') {
          log.info({ linesTotal }, 'Upload cancelled during processing');
          await deleteStagingFile(workspaceId, uploadId);
          return;
        }

        await updateUploadStatus(uploadId, 'processing', {
          linesTotal,
          linesParsed,
          linesSkipped,
        });
      }
    }

    // Handle case where format was detected but not all detection lines were processed
    if (!format && formatDetectionLines.length > 0) {
      format = detectFormat(formatDetectionLines);
      if (format) {
        for (const detectionLine of formatDetectionLines) {
          processLine(detectionLine, format, workspaceId, uploadId, visitBatch);
        }
        linesParsed += visitBatch.length;
        linesSkipped += formatDetectionLines.length - visitBatch.length;
      }
    }

    // Flush remaining visits
    if (visitBatch.length > 0) {
      await batchInsertVisits(visitBatch);
    }

    // Mark complete
    await updateUploadStatus(uploadId, 'completed', {
      linesTotal,
      linesParsed,
      linesSkipped,
    });

    // Enqueue aggregate jobs for each affected date
    const affectedDates = await getAffectedDates(uploadId);
    for (const date of affectedDates) {
      await boss.send(
        'crawler-aggregate',
        { workspaceId, date },
        {
          singletonKey: `crawler-agg:${workspaceId}:${date}`,
          singletonSeconds: 120,
        }
      );
    }

    log.info(
      { linesTotal, linesParsed, linesSkipped, affectedDates: affectedDates.length },
      'Crawler log parse completed'
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown parse error';
    log.error({ err }, 'Crawler log parse failed');
    await updateUploadStatus(uploadId, 'failed', {
      linesTotal,
      linesParsed,
      linesSkipped,
      errorMessage,
    });
  } finally {
    await deleteStagingFile(workspaceId, uploadId);
  }
}

function processLine(
  line: string,
  format: LogFormat,
  workspaceId: string,
  uploadId: string,
  batch: VisitInsert[]
): void {
  const parsed = parseLine(line, format);
  if (!parsed) return;

  const bot = identifyBot(parsed.userAgent);
  if (!bot) return;

  batch.push({
    workspaceId,
    uploadId,
    botName: bot.name,
    botCategory: bot.category,
    userAgent: parsed.userAgent,
    requestPath: parsed.path,
    requestMethod: parsed.method,
    statusCode: parsed.statusCode,
    responseBytes: parsed.responseBytes,
    visitedAt: parsed.timestamp,
  });
}
