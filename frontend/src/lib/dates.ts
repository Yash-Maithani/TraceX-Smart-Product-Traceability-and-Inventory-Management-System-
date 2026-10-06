/**
 * Date formatting utilities (SPEC §3.1, D-17, Phase 5 Part A).
 *
 * 1. formatBusinessDate(dateStr):
 *    Formats a calendar-day "YYYY-MM-DD" string without constructing a timezone-shifted
 *    Date at local midnight, guaranteeing identical day/month/year output in every
 *    browser/OS timezone (UTC, Asia/Kolkata, America/Los_Angeles, etc.).
 *
 * 2. formatTimestamp(isoInstantStr):
 *    Formats an ISO-8601 instant ("2026-10-05T04:25:33.806Z") in the user's local zone.
 */

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

export function parseBusinessDateParts(
  value: string | null | undefined
): { year: number; month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null;
  const match = ISO_DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? '0', 10);
  const month = Number.parseInt(match[2] ?? '0', 10);
  const day = Number.parseInt(match[3] ?? '0', 10);
  if (day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function isValidBusinessDate(value: string | null | undefined): value is string {
  return parseBusinessDateParts(value) !== null;
}

export { isValidBusinessDate as isValidIsoDateString };

/**
 * Formats a "YYYY-MM-DD" date-only string strictly by parsing the year, month, and day
 * components directly—never via `new Date(dateStr)` timezone conversion.
 */
export function formatBusinessDate(
  dateStr: string | null | undefined,
  style: 'short' | 'long' | 'iso' = 'short'
): string {
  if (dateStr === null || dateStr === undefined || dateStr.trim() === '') {
    return '—';
  }
  const parts = parseBusinessDateParts(dateStr);
  if (!parts) {
    return 'Invalid date';
  }
  if (style === 'iso') {
    return dateStr.trim();
  }
  const monthName =
    style === 'long'
      ? MONTH_NAMES_LONG[parts.month - 1]
      : MONTH_NAMES_SHORT[parts.month - 1];
  return `${monthName} ${parts.day}, ${parts.year}`;
}

/**
 * Formats an ISO-8601 timestamp (Instant) in the user's local time zone.
 */
export function formatTimestamp(isoInstant: string | null | undefined): string {
  if (isoInstant === null || isoInstant === undefined || isoInstant.trim() === '') {
    return '—';
  }
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid timestamp';
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export { formatTimestamp as formatInstant };
