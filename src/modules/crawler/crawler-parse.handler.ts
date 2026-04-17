import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { detectFormat, parseLine } from './crawler-log-parser';
import { identifyBot } from './crawler-bot-dictionary';
import { classifyLogLineForAiSource } from './crawler-referrer-classifier';
import {
  getUpload,
  getStagingPath,
  updateUploadStatus,
  deleteStagingFile,
} from './crawler-upload.service';
import { batchInsertVisits, getAffectedDates } from './crawler-visit.service';
import { batchInsertVisits as batchInsertAiVisits } from '@/modules/traffic/ai-visit.service';
import { detectUserAgentFamily } from '@/modules/traffic/ua-family';
import type { VisitInsert as AiVisitInsert } from '@/modules/traffic/traffic.types';
import type { CrawlerParseJobData, VisitInsert, LogFormat } from './crawler.types';

const BATCH_SIZE = 500;
const AI_BATCH_SIZE = 500;
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
  const aiVisitBatch: AiVisitInsert[] = [];
  const aiVisitDates = new Set<string>();
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
          let parsedDetections = 0;
          for (const detectionLine of formatDetectionLines) {
            if (
              processLine(
                detectionLine,
                format,
                workspaceId,
                uploadId,
                visitBatch,
                aiVisitBatch,
                aiVisitDates
              )
            ) {
              parsedDetections++;
            }
          }
          linesParsed += parsedDetections;
          linesSkipped += formatDetectionLines.length - parsedDetections;
        }
        continue;
      }

      // Parse line
      if (
        processLine(line, format, workspaceId, uploadId, visitBatch, aiVisitBatch, aiVisitDates)
      ) {
        linesParsed++;
      } else {
        linesSkipped++;
      }

      // Flush crawler batch when full
      if (visitBatch.length >= BATCH_SIZE) {
        await batchInsertVisits(visitBatch.splice(0, visitBatch.length));
      }

      // Flush AI visit batch when full
      if (aiVisitBatch.length >= AI_BATCH_SIZE) {
        await batchInsertAiVisits(aiVisitBatch.splice(0, aiVisitBatch.length));
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
        let parsedDetections = 0;
        for (const detectionLine of formatDetectionLines) {
          if (
            processLine(
              detectionLine,
              format,
              workspaceId,
              uploadId,
              visitBatch,
              aiVisitBatch,
              aiVisitDates
            )
          ) {
            parsedDetections++;
          }
        }
        linesParsed += parsedDetections;
        linesSkipped += formatDetectionLines.length - parsedDetections;
      }
    }

    // Flush remaining crawler visits
    if (visitBatch.length > 0) {
      await batchInsertVisits(visitBatch);
    }

    // Flush remaining AI visits
    if (aiVisitBatch.length > 0) {
      await batchInsertAiVisits(aiVisitBatch);
    }

    // Mark complete
    await updateUploadStatus(uploadId, 'completed', {
      linesTotal,
      linesParsed,
      linesSkipped,
    });

    // Enqueue crawler aggregate jobs for each affected date
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

    // Enqueue traffic aggregate jobs for each AI-visit date
    for (const date of aiVisitDates) {
      await boss.send(
        'traffic-aggregate',
        { workspaceId, date },
        {
          singletonKey: `traffic-agg:${workspaceId}:${date}`,
          singletonSeconds: 120,
        }
      );
    }

    log.info(
      {
        linesTotal,
        linesParsed,
        linesSkipped,
        affectedDates: affectedDates.length,
        aiVisitDates: aiVisitDates.size,
      },
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
  batch: VisitInsert[],
  aiVisitBatch: AiVisitInsert[],
  aiVisitDates: Set<string>
): boolean {
  const parsed = parseLine(line, format);
  if (!parsed) return false;

  const bot = identifyBot(parsed.userAgent);
  if (bot) {
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
    return true;
  }

  const aiMatch = classifyLogLineForAiSource(parsed);
  if (aiMatch) {
    aiVisitBatch.push({
      workspaceId,
      source: 'log',
      platform: aiMatch.platform,
      referrerHost: aiMatch.referrerHost,
      landingPath: parsed.path,
      userAgentFamily: detectUserAgentFamily(parsed.userAgent),
      siteKeyId: null,
      visitedAt: parsed.timestamp,
    });
    aiVisitDates.add(parsed.timestamp.toISOString().slice(0, 10));
    return true;
  }

  return false;
}
