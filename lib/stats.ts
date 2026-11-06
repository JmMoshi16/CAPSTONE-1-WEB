// Dashboard and Analytics arithmetic. No imports, so `node --test` runs it.

/** n as a percentage of `of`, 0 when `of` is 0. Both numbers must cover the same period. */
export const rate = (n: number, of: number): number => (of > 0 ? (n / of) * 100 : 0);

/** The busiest hour (0-23), the first of equal peaks, or null when every hour is 0. */
export function peakHour(hours: number[]): number | null {
  const max = Math.max(0, ...hours);
  return max > 0 ? hours.indexOf(max) : null;
}

/** Start of the last `days` calendar days, today included (local midnight); 0 days means all time. */
export function rangeStart(days: number, now: Date): Date {
  return days > 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)) : new Date(0);
}
