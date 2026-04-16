/**
 * Formats the duration between two ISO timestamps using i18n keys.
 * Returns null if either timestamp is missing.
 */
export function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
  t: (key: string, values?: Record<string, unknown>) => string
): string | null {
  if (!startedAt || !completedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = Math.max(0, end - start);

  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds < 1) {
    return t('duration.subSecond');
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return t('duration.hoursMinutes', { hours, minutes });
  }

  if (minutes > 0) {
    return t('duration.minutesSeconds', { minutes, seconds });
  }

  return t('duration.seconds', { value: seconds });
}
