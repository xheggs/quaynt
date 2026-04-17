// Shared constants + types for the GSC sync job. Kept in a separate file so
// the API route that enqueues can import them without pulling in the handler
// (which would require a pg-boss instance at module load time).

export const GSC_SYNC_QUEUE = 'gsc-sync';
export const GSC_DAILY_SYNC_QUEUE = 'gsc-daily-sync';

export interface GscSyncJobData {
  workspaceId: string;
  gscConnectionId: string;
  fromDate?: string; // ISO YYYY-MM-DD — defaults to today-30 in handler
  toDate?: string; // ISO YYYY-MM-DD — defaults to today in handler
}
