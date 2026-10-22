/**
 * Shared display text for values that are missing. Used instead of a dash so every empty
 * field reads the same way across the app.
 */
export const EMPTY_VALUE = 'Not recorded';

/** Formats a day count with its unit, or EMPTY_VALUE when the count is missing. */
export function formatDays(days: number | null | undefined, unit: string): string {
  return days === null || days === undefined ? EMPTY_VALUE : `${days}${unit}`;
}
