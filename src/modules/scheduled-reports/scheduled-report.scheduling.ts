import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import type { ScheduleFrequency, ScheduleScope } from './scheduled-report.types';

const log = logger.child({ module: 'scheduled-reports' });

// --- Next-run computation ---

export function computeNextRunAt(
  frequency: ScheduleFrequency,
  hour: number,
  dayOfWeek: number,
  dayOfMonth: number,
  timezone: string,
  afterDate?: Date
): Date {
  const now = afterDate ?? new Date();

  // Start from the next hour boundary to ensure we always return a future date
  const candidate = new Date(now.getTime() + 60_000);

  // Try up to 400 days ahead to find the next valid occurrence
  for (let i = 0; i < 400 * 24; i++) {
    const check = new Date(candidate.getTime() + i * 60 * 60 * 1000);
    const localHour = getHourInTimezone(check, timezone);

    if (localHour !== hour) continue;

    let matched = false;

    if (frequency === 'daily') {
      matched = true;
    } else if (frequency === 'weekly') {
      const localDay = getDayOfWeekInTimezone(check, timezone);
      matched = localDay === dayOfWeek;
    } else if (frequency === 'monthly') {
      const localDom = getDayOfMonthInTimezone(check, timezone);
      const lastDay = getLastDayOfMonthInTimezone(check, timezone);
      matched = dayOfMonth === -1 ? localDom === lastDay : localDom === dayOfMonth;
    }

    if (matched) {
      const result = toStartOfHour(check, timezone, hour);
      // toStartOfHour snaps to the top of the hour, which may be before `now`
      // if we're still within the target hour. Skip and continue to the next day.
      if (result > now) return result;
    }
  }

  // Fallback: should never reach here for valid inputs
  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  log.warn({ frequency, hour, dayOfWeek, dayOfMonth, timezone }, 'Could not compute next run');
  return fallback;
}

function toStartOfHour(date: Date, timezone: string, targetHour: number): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));

  const localStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(targetHour).padStart(2, '0')}:00:00`;
  const naiveUtc = new Date(localStr + 'Z');

  const hourInTz = getHourInTimezone(naiveUtc, timezone);
  const offsetHours = hourInTz - targetHour;
  return new Date(naiveUtc.getTime() - offsetHours * 60 * 60 * 1000);
}

function getHourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'] ?? 1;
}

function getDayOfMonthInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    day: 'numeric',
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'day')?.value ?? 1);
}

function getLastDayOfMonthInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  return new Date(year, month, 0).getDate();
}

// --- Report period computation ---

export function computeReportPeriod(scope: ScheduleScope): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  const from = new Date(now.getTime() - scope.periodDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  return { from, to };
}

// --- Unsubscribe tokens ---

export function generateScheduleUnsubscribeToken(recipientId: string, scheduleId: string): string {
  const payload = `${recipientId}:${scheduleId}:schedule`;
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const hmac = createHmac('sha256', env.BETTER_AUTH_SECRET).update(payload).digest('base64url');
  return `${payloadB64}.${hmac}`;
}

export function validateScheduleUnsubscribeToken(
  token: string
): { valid: true; recipientId: string; scheduleId: string } | { valid: false } {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return { valid: false };

  const payloadB64 = token.slice(0, dotIndex);
  const receivedHmac = token.slice(dotIndex + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString();
  } catch {
    return { valid: false };
  }

  const expectedHmac = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(payload)
    .digest('base64url');

  try {
    const isValid = timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac));
    if (!isValid) return { valid: false };
  } catch {
    return { valid: false };
  }

  const parts = payload.split(':');
  if (parts.length !== 3 || parts[2] !== 'schedule') return { valid: false };

  return { valid: true, recipientId: parts[0], scheduleId: parts[1] };
}
