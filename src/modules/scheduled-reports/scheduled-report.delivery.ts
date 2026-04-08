import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { generatePrefixedId } from '@/lib/db/id';
import { reportSchedule } from './scheduled-report.schema';
import { reportJob } from '@/modules/pdf/report-job.schema';
import type { ReportJobScope } from '@/modules/pdf/report-job.schema';
import { generatePdfReport } from '@/modules/pdf/pdf-generator.service';
import { fetchExportData } from '@/modules/exports/export.fetchers';
import { formatCsv } from '@/modules/exports/csv-formatter.service';
import { formatJson, buildJsonMeta } from '@/modules/exports/json-formatter.service';
import { exportColumns } from '@/modules/exports/export.columns';
import { renderScheduledReportEmail } from './scheduled-report.render';
import { generateScheduleUnsubscribeToken } from './scheduled-report.scheduling';
import type { ScheduleScope } from './scheduled-report.types';

import exportMessages from '../../../locales/en/exports.json';

const PDF_ATTACHMENT_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

function loadColumnHeaders(): Record<string, string> {
  const columns = (exportMessages as { exports: { columns: Record<string, string> } }).exports
    .columns;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(columns)) {
    headers[`exports.columns.${key}`] = value;
  }
  return headers;
}

// --- PDF generation helper ---

export async function generatePdfForSchedule(
  workspaceId: string,
  workspaceName: string,
  scope: ScheduleScope,
  from: string,
  to: string,
  locale: string
) {
  const jobId = generatePrefixedId('reportJob');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db.insert(reportJob).values({
    id: jobId,
    workspaceId,
    createdBy: 'system:scheduler',
    status: 'processing',
    scope: {
      promptSetId: scope.promptSetId,
      brandIds: scope.brandIds,
      from,
      to,
      comparisonPeriod: scope.comparisonPeriod,
      metrics: scope.metrics,
      platformId: scope.platformId,
      locale: scope.locale,
      templateId: scope.templateId,
    } satisfies ReportJobScope,
    locale,
    expiresAt,
    startedAt: new Date(),
  });

  const result = await generatePdfReport({
    jobId,
    workspaceId,
    workspaceName,
    scope: {
      promptSetId: scope.promptSetId,
      brandIds: scope.brandIds,
      from,
      to,
      comparisonPeriod: scope.comparisonPeriod,
      metrics: scope.metrics,
      platformId: scope.platformId,
    },
    locale,
    storagePath: env.REPORT_STORAGE_PATH,
    templateId: scope.templateId,
  });

  await db
    .update(reportJob)
    .set({
      status: 'completed',
      filePath: result.filePath,
      fileSizeBytes: result.fileSizeBytes,
      pageCount: result.pageCount,
      completedAt: new Date(),
    })
    .where(eq(reportJob.id, jobId));

  return { jobId, filePath: result.filePath, fileSizeBytes: result.fileSizeBytes };
}

// --- CSV/JSON export helper ---

export async function generateExportFile(
  workspaceId: string,
  scope: ScheduleScope,
  from: string,
  to: string,
  format: 'csv' | 'json',
  scheduleId: string
) {
  const fetcherParams: Record<string, string | undefined> = {
    promptSetId: scope.promptSetId,
    brandIds: scope.brandIds.join(','),
    from,
    to,
    comparisonPeriod: scope.comparisonPeriod,
    metrics: scope.metrics?.join(','),
    platformId: scope.platformId,
    locale: scope.locale,
  };

  const result = await fetchExportData('report', workspaceId, fetcherParams);
  const columns = exportColumns.report;
  const headers = loadColumnHeaders();

  let stream: ReadableStream<Uint8Array>;
  let extension: string;

  if (format === 'csv') {
    stream = formatCsv(result.rows, columns, headers);
    extension = 'csv';
  } else {
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: fetcherParams,
      columns,
      headers,
      truncated: result.truncated ?? false,
      rowLimit: 100_000,
    });
    stream = formatJson(result.rows, meta);
    extension = 'json';
  }

  // Write stream to temp file
  const scheduledDir = join(env.REPORT_STORAGE_PATH, 'scheduled');
  await fs.mkdir(scheduledDir, { recursive: true });

  const filename = `${scheduleId}_${Date.now()}.${extension}`;
  const filePath = join(scheduledDir, filename);
  const fileHandle = await fs.open(filePath, 'w');

  try {
    const reader = stream.getReader();
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await fileHandle.write(value);
      totalBytes += value.byteLength;
    }
    return { filePath, fileSizeBytes: totalBytes };
  } finally {
    await fileHandle.close();
  }
}

// --- Email delivery helper ---

export async function deliverByEmail(
  boss: PgBoss,
  schedule: typeof reportSchedule.$inferSelect,
  recipient: { id: string; address: string },
  reportFilePath: string | null,
  fileSizeBytes: number,
  from: string,
  to: string,
  locale: string,
  baseUrl: string,
  deliveryId: string
) {
  const unsubscribeToken = generateScheduleUnsubscribeToken(recipient.id, schedule.id);
  const unsubscribeUrl = `${baseUrl}/api/v1/reports/unsubscribe?recipientId=${recipient.id}&token=${unsubscribeToken}`;

  const rendered = await renderScheduledReportEmail({
    scheduleName: schedule.name,
    format: schedule.format,
    periodFrom: from,
    periodTo: to,
    locale,
    baseUrl,
    unsubscribeUrl,
    isPdfAttached: schedule.format === 'pdf' && fileSizeBytes <= PDF_ATTACHMENT_SIZE_LIMIT,
    downloadUrl:
      schedule.format === 'pdf'
        ? `${baseUrl}/api/v1/reports/pdf/${deliveryId}/download`
        : reportFilePath
          ? `${baseUrl}/api/v1/reports/schedules/${schedule.id}/deliveries`
          : null,
  });

  // Build email job data
  const emailJobData: Record<string, unknown> = {
    notificationLogId: deliveryId,
    recipientEmail: recipient.address,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: rendered.headers,
  };

  // Attach PDF if small enough
  if (schedule.format === 'pdf' && reportFilePath && fileSizeBytes <= PDF_ATTACHMENT_SIZE_LIMIT) {
    const fileBuffer = await fs.readFile(reportFilePath);
    emailJobData.attachments = [
      {
        filename: `${schedule.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`,
        content: fileBuffer.toString('base64'),
        encoding: 'base64',
        contentType: 'application/pdf',
      },
    ];
  }

  await boss.send('email-send', emailJobData, {
    retryLimit: 5,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 3600,
  });
}
