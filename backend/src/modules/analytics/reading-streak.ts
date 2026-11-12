/** Consecutive UTC reading days. Yesterday's streak stays active until today ends. */
export function readingStreakFromDates(dates: Date[], now = new Date()): number {
  const dayMs = 86400000;
  const today = Math.floor(now.getTime() / dayMs);
  const days = new Set(dates.map((date) => Math.floor(date.getTime() / dayMs)));
  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(cursor)) { streak++; cursor--; }
  return streak;
}
