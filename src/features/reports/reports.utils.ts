import cronstrue from 'cronstrue';

/**
 * Converts a cron expression to a human-readable description.
 * Wraps the cronstrue library to isolate the dependency.
 */
export function describeCron(expression: string, locale?: string): string {
  try {
    return cronstrue.toString(expression, {
      locale: locale ?? 'en',
      use24HourTimeFormat: false,
    });
  } catch {
    return expression;
  }
}
