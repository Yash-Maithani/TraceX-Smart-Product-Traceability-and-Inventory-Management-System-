import { describe, expect, it } from 'vitest';
import {
  formatBusinessDate,
  formatTimestamp,
  isValidBusinessDate,
  parseBusinessDateParts
} from './dates';

describe('src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A)', () => {
  it('validates canonical YYYY-MM-DD calendar strings and rejects invalid dates', () => {
    expect(isValidBusinessDate('2026-10-09')).toBe(true);
    expect(isValidBusinessDate('2024-02-29')).toBe(true);
    expect(isValidBusinessDate('2026-02-29')).toBe(false);
    expect(isValidBusinessDate('not-a-date')).toBe(false);
    expect(isValidBusinessDate('2026-10-09T00:00:00Z')).toBe(false);
    expect(isValidBusinessDate(null)).toBe(false);
    expect(isValidBusinessDate(undefined)).toBe(false);
  });

  it('parses YYYY-MM-DD parts purely lexically without Date instantiation', () => {
    expect(parseBusinessDateParts('2026-10-09')).toEqual({
      year: 2026,
      month: 10,
      day: 9
    });
    expect(parseBusinessDateParts('invalid')).toBeNull();
  });

  it.each(['UTC', 'Asia/Kolkata', 'America/Los_Angeles'])(
    'formats business date "2026-10-09" identically when process.env.TZ = %s',
    (tz) => {
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = tz;
        expect(formatBusinessDate('2026-10-09', 'short')).toBe('Oct 9, 2026');
        expect(formatBusinessDate('2026-10-09', 'long')).toBe('October 9, 2026');
        expect(formatBusinessDate('2026-10-09', 'iso')).toBe('2026-10-09');
      } finally {
        if (originalTz === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTz;
        }
      }
    }
  );

  it('returns fallback for missing or corrupted business dates', () => {
    expect(formatBusinessDate(null)).toBe('—');
    expect(formatBusinessDate(undefined)).toBe('—');
    expect(formatBusinessDate('not-a-date')).toBe('Invalid date');
  });

  it('formats ISO timestamps and handles missing/invalid values gracefully', () => {
    expect(formatTimestamp('2026-10-05T04:00:00Z')).toContain('2026');
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp('corrupted-instant')).toBe('Invalid timestamp');
  });
});
