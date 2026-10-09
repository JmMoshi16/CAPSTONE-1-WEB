// Safe date handling (audit M-06). Firestore data contains Timestamps, ISO strings with and without
// an offset, and missing values; `format(new Date(x))` throws RangeError on the bad ones and
// white-screens the page. Everything here returns null / a fallback instead of throwing.
import { format, formatDistanceToNow } from 'date-fns';

export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  let d: Date;
  if (v instanceof Date) d = v;
  else if (typeof v === 'string' || typeof v === 'number') d = new Date(v);
  else if (typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') d = (v as { toDate: () => Date }).toDate();
  else if (typeof v === 'object' && typeof (v as { seconds?: unknown }).seconds === 'number') d = new Date((v as { seconds: number }).seconds * 1000);
  else return null;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO string for storage in React state, or '' when the value is missing/invalid. */
export function toIso(v: unknown): string {
  return toDate(v)?.toISOString() ?? '';
}

export function fmtDate(v: unknown, pattern: string, fallback = '—'): string {
  const d = toDate(v);
  return d ? format(d, pattern) : fallback;
}

export function fmtAgo(v: unknown, fallback = '—'): string {
  const d = toDate(v);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : fallback;
}

/** Milliseconds since epoch for sorting; missing dates sort as oldest. */
export function timeOf(v: unknown): number {
  return toDate(v)?.getTime() ?? 0;
}

/** `v` plus `days` days, or null when `v` is not a valid date. */
export function addDaysTo(v: unknown, days: number): Date | null {
  const d = toDate(v);
  return d ? new Date(d.getTime() + days * 86_400_000) : null;
}

/** True when `v + days` is in the past. Unknown dates are NOT treated as expired. */
export function isOlderThanDays(v: unknown, days: number, now: Date = new Date()): boolean {
  const end = addDaysTo(v, days);
  return end !== null && now > end;
}

/** Local yyyy-MM-dd key for grouping by day, or null. */
export function dayKey(v: unknown): string | null {
  const d = toDate(v);
  return d ? format(d, 'yyyy-MM-dd') : null;
}
