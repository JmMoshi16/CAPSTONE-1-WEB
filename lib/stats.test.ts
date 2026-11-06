// Run with: npm test. The dashboard's numbers, kept out of the pages so they can be checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStreak } from './claim.ts';
import { peakHour, rate, rangeStart } from './stats.ts';

const day = (s: string) => new Date(`${s}T10:00:00`);

test('a streak shows only while it can still be extended: scanned today or yesterday (like the app)', () => {
  assert.equal(activeStreak({ streak: 7, lastScanDate: '2026-11-05' }, day('2026-11-05')), 7);
  assert.equal(activeStreak({ streak: 7, lastScanDate: '2026-11-04' }, day('2026-11-05')), 7);
  assert.equal(activeStreak({ streak: 7, lastScanDate: '2026-10-05' }, day('2026-11-05')), 0, 'lapsed a month ago');
  assert.equal(activeStreak({ streak: 3 }, day('2026-11-05')), 0, 'never scanned');
  assert.equal(activeStreak({ lastScanDate: '2026-11-05' }, day('2026-11-05')), 0);
});

test('peak hour: the busiest hour, or none when nothing was scanned', () => {
  const hours = new Array<number>(24).fill(0);
  assert.equal(peakHour(hours), null);
  hours[9] = 4; hours[17] = 6; hours[18] = 6;
  assert.equal(peakHour(hours), 17, 'the first of equal peaks');
});

test('rate: a share of the same period, 0 when there is nothing to divide by', () => {
  assert.equal(rate(5, 20), 25);
  assert.equal(rate(3, 0), 0);
});

test('a 7-day range is 7 whole calendar days, today included, so totals match the 7 chart bars', () => {
  const now = new Date('2026-11-05T15:30:00');
  assert.deepEqual(rangeStart(7, now), new Date('2026-10-30T00:00:00'));
  assert.deepEqual(rangeStart(1, now), new Date('2026-11-05T00:00:00'));
  assert.deepEqual(rangeStart(0, now), new Date(0), 'all time');
});
