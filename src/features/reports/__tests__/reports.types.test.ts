import { describe, it, expect } from 'vitest';
import { deriveScheduleStatus } from '../reports.types';
import type { ReportSchedule } from '../reports.types';

function makeSchedule(overrides: Partial<ReportSchedule> = {}): ReportSchedule {
  return {
    id: 'sched-1',
    workspaceId: 'ws-1',
    name: 'Test Schedule',
    promptSetId: 'ps-1',
    brandIds: ['b-1'],
    schedule: '0 9 * * MON',
    recipients: ['test@example.com'],
    format: 'pdf',
    enabled: true,
    sendIfEmpty: false,
    consecutiveFailures: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveScheduleStatus', () => {
  it('returns "active" for enabled schedule with fewer than 5 failures', () => {
    const schedule = makeSchedule({ enabled: true, consecutiveFailures: 0 });
    expect(deriveScheduleStatus(schedule)).toBe('active');
  });

  it('returns "active" for enabled schedule with 4 failures', () => {
    const schedule = makeSchedule({ enabled: true, consecutiveFailures: 4 });
    expect(deriveScheduleStatus(schedule)).toBe('active');
  });

  it('returns "paused" for disabled schedule with fewer than 5 failures', () => {
    const schedule = makeSchedule({ enabled: false, consecutiveFailures: 0 });
    expect(deriveScheduleStatus(schedule)).toBe('paused');
  });

  it('returns "disabled" for schedule with 5 or more consecutive failures', () => {
    const schedule = makeSchedule({ enabled: true, consecutiveFailures: 5 });
    expect(deriveScheduleStatus(schedule)).toBe('disabled');
  });

  it('returns "disabled" for schedule with many consecutive failures even if disabled', () => {
    const schedule = makeSchedule({ enabled: false, consecutiveFailures: 10 });
    expect(deriveScheduleStatus(schedule)).toBe('disabled');
  });
});
