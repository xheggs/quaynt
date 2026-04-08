import { eq, and, isNull, lte, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paginationConfig, countTotal } from '@/lib/db/query-helpers';
import { reportSchedule, scheduleRecipient, reportDelivery } from './scheduled-report.schema';
import type {
  CreateReportScheduleInput,
  UpdateReportScheduleInput,
  ScheduledReportJobData,
} from './scheduled-report.types';
import { computeNextRunAt, validateScheduleUnsubscribeToken } from './scheduled-report.scheduling';

// Re-export for external consumers
export {
  computeNextRunAt,
  computeReportPeriod,
  generateScheduleUnsubscribeToken,
  validateScheduleUnsubscribeToken,
} from './scheduled-report.scheduling';

const log = logger.child({ module: 'scheduled-reports' });

const MAX_SCHEDULES_PER_WORKSPACE = 25;

// --- CRUD ---

export async function createSchedule(
  workspaceId: string,
  userId: string,
  input: CreateReportScheduleInput
) {
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reportSchedule)
    .where(and(eq(reportSchedule.workspaceId, workspaceId), isNull(reportSchedule.deletedAt)));

  if ((existing?.count ?? 0) >= MAX_SCHEDULES_PER_WORKSPACE) {
    throw new Error('SCHEDULE_LIMIT_EXCEEDED');
  }

  const nextRunAt = computeNextRunAt(
    input.frequency,
    input.hour,
    input.dayOfWeek ?? 1,
    input.dayOfMonth ?? 1,
    input.timezone
  );

  return db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(reportSchedule)
      .values({
        workspaceId,
        createdBy: userId,
        name: input.name,
        frequency: input.frequency,
        hour: input.hour,
        dayOfWeek: input.dayOfWeek ?? 1,
        dayOfMonth: input.dayOfMonth ?? 1,
        timezone: input.timezone,
        format: input.format,
        scope: input.scope,
        nextRunAt,
      })
      .returning();

    if (input.recipients.length > 0) {
      await tx.insert(scheduleRecipient).values(
        input.recipients.map((r) => ({
          scheduleId: schedule.id,
          type: r.type as 'email' | 'webhook',
          address: r.address,
        }))
      );
    }

    const recipients = await tx
      .select()
      .from(scheduleRecipient)
      .where(eq(scheduleRecipient.scheduleId, schedule.id));

    return { ...schedule, recipients };
  });
}

export async function listSchedules(
  workspaceId: string,
  pagination: { page: number; limit: number }
) {
  const conditions: SQL[] = [
    eq(reportSchedule.workspaceId, workspaceId),
    isNull(reportSchedule.deletedAt),
  ];

  const { limit, offset } = paginationConfig(pagination);

  const [items, total] = await Promise.all([
    db
      .select()
      .from(reportSchedule)
      .where(and(...conditions))
      .orderBy(reportSchedule.nextRunAt)
      .limit(limit)
      .offset(offset),
    countTotal(reportSchedule, conditions),
  ]);

  return { items, total };
}

export async function getSchedule(workspaceId: string, scheduleId: string) {
  const [schedule] = await db
    .select()
    .from(reportSchedule)
    .where(
      and(
        eq(reportSchedule.id, scheduleId),
        eq(reportSchedule.workspaceId, workspaceId),
        isNull(reportSchedule.deletedAt)
      )
    )
    .limit(1);

  if (!schedule) return null;

  const recipients = await db
    .select()
    .from(scheduleRecipient)
    .where(eq(scheduleRecipient.scheduleId, scheduleId));

  const recentDeliveries = await db
    .select()
    .from(reportDelivery)
    .where(eq(reportDelivery.scheduleId, scheduleId))
    .orderBy(desc(reportDelivery.createdAt))
    .limit(10);

  return { ...schedule, recipients, recentDeliveries };
}

export async function updateSchedule(
  workspaceId: string,
  scheduleId: string,
  input: UpdateReportScheduleInput
) {
  const existing = await getSchedule(workspaceId, scheduleId);
  if (!existing) return null;

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.frequency !== undefined) updates.frequency = input.frequency;
  if (input.hour !== undefined) updates.hour = input.hour;
  if (input.dayOfWeek !== undefined) updates.dayOfWeek = input.dayOfWeek;
  if (input.dayOfMonth !== undefined) updates.dayOfMonth = input.dayOfMonth;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.format !== undefined) updates.format = input.format;
  if (input.scope !== undefined) updates.scope = input.scope;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  const scheduleFieldsChanged =
    input.frequency !== undefined ||
    input.hour !== undefined ||
    input.dayOfWeek !== undefined ||
    input.dayOfMonth !== undefined ||
    input.timezone !== undefined;

  if (scheduleFieldsChanged) {
    updates.nextRunAt = computeNextRunAt(
      input.frequency ?? existing.frequency,
      input.hour ?? existing.hour,
      input.dayOfWeek ?? existing.dayOfWeek,
      input.dayOfMonth ?? existing.dayOfMonth,
      input.timezone ?? existing.timezone
    );
  }

  return db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx.update(reportSchedule).set(updates).where(eq(reportSchedule.id, scheduleId));
    }

    if (input.recipients !== undefined) {
      const currentRecipients = await tx
        .select()
        .from(scheduleRecipient)
        .where(eq(scheduleRecipient.scheduleId, scheduleId));

      const unsubMap = new Map(
        currentRecipients
          .filter((r) => r.unsubscribed)
          .map((r) => [
            `${r.type}:${r.address}`,
            { unsubscribed: true, unsubscribedAt: r.unsubscribedAt },
          ])
      );

      await tx.delete(scheduleRecipient).where(eq(scheduleRecipient.scheduleId, scheduleId));

      if (input.recipients.length > 0) {
        await tx.insert(scheduleRecipient).values(
          input.recipients.map((r) => {
            const key = `${r.type}:${r.address}`;
            const unsub = unsubMap.get(key);
            return {
              scheduleId,
              type: r.type as 'email' | 'webhook',
              address: r.address,
              unsubscribed: unsub?.unsubscribed ?? false,
              unsubscribedAt: unsub?.unsubscribedAt ?? null,
            };
          })
        );
      }
    }

    const [updated] = await tx
      .select()
      .from(reportSchedule)
      .where(eq(reportSchedule.id, scheduleId));

    const recipients = await tx
      .select()
      .from(scheduleRecipient)
      .where(eq(scheduleRecipient.scheduleId, scheduleId));

    return { ...updated, recipients };
  });
}

export async function deleteSchedule(workspaceId: string, scheduleId: string): Promise<boolean> {
  const [result] = await db
    .update(reportSchedule)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(reportSchedule.id, scheduleId),
        eq(reportSchedule.workspaceId, workspaceId),
        isNull(reportSchedule.deletedAt)
      )
    )
    .returning({ id: reportSchedule.id });

  return !!result;
}

export async function triggerSchedule(
  workspaceId: string,
  scheduleId: string,
  boss: PgBoss
): Promise<boolean> {
  const schedule = await getSchedule(workspaceId, scheduleId);
  if (!schedule) return false;

  const jobData: ScheduledReportJobData = {
    scheduleId,
    workspaceId,
  };

  await boss.send('scheduled-report-generate', jobData, {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 3600,
    singletonKey: `sched_${scheduleId}_manual`,
    singletonSeconds: 60,
  });

  log.info({ scheduleId }, 'Schedule manually triggered');
  return true;
}

export async function unsubscribeRecipient(
  recipientId: string,
  token: string
): Promise<'success' | 'already_unsubscribed' | 'invalid_token'> {
  const validated = validateScheduleUnsubscribeToken(token);
  if (!validated.valid || validated.recipientId !== recipientId) {
    return 'invalid_token';
  }

  const [recipient] = await db
    .select()
    .from(scheduleRecipient)
    .where(eq(scheduleRecipient.id, recipientId))
    .limit(1);

  if (!recipient) return 'invalid_token';
  if (recipient.unsubscribed) return 'already_unsubscribed';

  await db
    .update(scheduleRecipient)
    .set({ unsubscribed: true, unsubscribedAt: new Date() })
    .where(eq(scheduleRecipient.id, recipientId));

  log.info({ recipientId }, 'Recipient unsubscribed from scheduled report');
  return 'success';
}

export async function listDeliveries(
  workspaceId: string,
  scheduleId: string,
  pagination: { page: number; limit: number }
) {
  const [schedule] = await db
    .select({ id: reportSchedule.id })
    .from(reportSchedule)
    .where(and(eq(reportSchedule.id, scheduleId), eq(reportSchedule.workspaceId, workspaceId)))
    .limit(1);

  if (!schedule) return null;

  const conditions: SQL[] = [eq(reportDelivery.scheduleId, scheduleId)];
  const { limit, offset } = paginationConfig(pagination);

  const [items, total] = await Promise.all([
    db
      .select()
      .from(reportDelivery)
      .where(and(...conditions))
      .orderBy(desc(reportDelivery.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(reportDelivery, conditions),
  ]);

  return { items, total };
}

// --- Helpers used by the handler ---

export async function getDueSchedules() {
  const now = new Date();

  return db
    .select()
    .from(reportSchedule)
    .where(
      and(
        eq(reportSchedule.enabled, true),
        isNull(reportSchedule.deletedAt),
        lte(reportSchedule.nextRunAt, now)
      )
    );
}

export async function advanceScheduleNextRun(scheduleId: string) {
  const [schedule] = await db
    .select()
    .from(reportSchedule)
    .where(eq(reportSchedule.id, scheduleId))
    .limit(1);

  if (!schedule) return;

  const nextRunAt = computeNextRunAt(
    schedule.frequency,
    schedule.hour,
    schedule.dayOfWeek,
    schedule.dayOfMonth,
    schedule.timezone,
    new Date()
  );

  await db.update(reportSchedule).set({ nextRunAt }).where(eq(reportSchedule.id, scheduleId));
}

export async function markScheduleSuccess(scheduleId: string) {
  await db
    .update(reportSchedule)
    .set({
      lastRunAt: new Date(),
      consecutiveFailures: 0,
      lastError: null,
    })
    .where(eq(reportSchedule.id, scheduleId));
}

export async function markScheduleFailure(scheduleId: string, error: string) {
  const [schedule] = await db
    .select({ consecutiveFailures: reportSchedule.consecutiveFailures })
    .from(reportSchedule)
    .where(eq(reportSchedule.id, scheduleId))
    .limit(1);

  const failures = (schedule?.consecutiveFailures ?? 0) + 1;
  const shouldDisable = failures >= 5;

  await db
    .update(reportSchedule)
    .set({
      lastRunAt: new Date(),
      consecutiveFailures: failures,
      lastError: error,
      ...(shouldDisable && { enabled: false }),
    })
    .where(eq(reportSchedule.id, scheduleId));

  if (shouldDisable) {
    log.warn({ scheduleId, failures }, 'Schedule auto-disabled after consecutive failures');
  }

  return { failures, autoDisabled: shouldDisable };
}

export async function getActiveRecipients(scheduleId: string) {
  return db
    .select()
    .from(scheduleRecipient)
    .where(
      and(eq(scheduleRecipient.scheduleId, scheduleId), eq(scheduleRecipient.unsubscribed, false))
    );
}
