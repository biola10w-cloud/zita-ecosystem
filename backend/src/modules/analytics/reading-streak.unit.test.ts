import { describe, expect, it } from 'vitest';
import { readingStreakFromDates } from './reading-streak';

describe('reader dashboard streak', () => {
  const now = new Date('2026-09-18T00:15:00Z');
  const dates = (...values: string[]) => values.map((value) => new Date(value));
  it('shows zero for a new reader or a broken streak', () => {
    expect(readingStreakFromDates([], now)).toBe(0);
    expect(readingStreakFromDates(dates('2026-09-16'), now)).toBe(0);
  });
  it('counts consecutive days once even with multiple sessions per day', () => {
    expect(readingStreakFromDates(dates('2026-09-18', '2026-09-18', '2026-09-17', '2026-09-16', '2026-09-14'), now)).toBe(3);
  });
  it('preserves the streak after midnight before the reader returns', () => {
    expect(readingStreakFromDates(dates('2026-09-17', '2026-09-16'), now)).toBe(2);
  });
  it('uses UTC and ignores future activity', () => {
    expect(readingStreakFromDates(dates('2026-09-20', '2026-09-17T23:30:00-02:00', '2026-09-17'), now)).toBe(2);
  });
});
