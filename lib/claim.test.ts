// Run with: npm test. Manual Claim must credit exactly like the phone app (lib/core/gamification.dart).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creditScan, multiplierFor, nextStreak, pickClaimToken } from './claim.ts';

const RULES = JSON.parse(readFileSync(new URL('../config/rules.json', import.meta.url), 'utf8'));
const day = (s: string) => new Date(`${s}T10:00:00`);   // local time, like the app

test('streak: same day keeps it, next day adds one, a gap restarts at 1', () => {
  assert.equal(nextStreak(0, undefined, day('2026-10-23')), 1);
  assert.equal(nextStreak(4, '2026-10-23', day('2026-10-23')), 4);
  assert.equal(nextStreak(0, '2026-10-23', day('2026-10-23')), 1);
  assert.equal(nextStreak(4, '2026-10-22', day('2026-10-23')), 5);
  assert.equal(nextStreak(4, '2026-10-20', day('2026-10-23')), 1);
});

test('multiplier tiers come from rules.json: 1-2 days 1x, 3-6 days 1.5x, 7+ 2x', () => {
  const tiers = RULES.streakMultipliers;
  assert.deepEqual([0, 1, 2, 3, 6, 7, 30].map(s => multiplierFor(s, tiers)), [1, 1, 1, 1.5, 1.5, 2, 2]);
});

test('credit: points x multiplier, lifetime and scanCount move, badges unlock like the app', () => {
  const c = creditScan({ points: 40, lifetimePoints: 95, scanCount: 4, streak: 2, lastScanDate: '2026-10-22', badges: ['first_scan', 'pts_50'] },
    5, day('2026-10-23'), RULES);
  assert.equal(c.streak, 3);
  assert.equal(c.multiplier, 1.5);
  assert.equal(c.awarded, 8);                 // 5 x 1.5 = 7.5, rounded like Dart's round()
  assert.deepEqual([c.points, c.lifetimePoints, c.scanCount], [48, 103, 5]);
  assert.equal(c.lastScanDate, '2026-10-23');
  assert.deepEqual(c.newBadges.sort(), ['pts_100', 'scan_5', 'streak_3']);
  assert.deepEqual(c.badges.slice(0, 1), ['first_scan']);
});

test('credit: older documents without lifetimePoints start from the balance', () => {
  const c = creditScan({ points: 30 }, 10, day('2026-10-23'), RULES);
  assert.deepEqual([c.points, c.lifetimePoints, c.scanCount, c.streak], [40, 40, 1, 1]);
  assert.ok(c.newBadges.includes('first_scan'));
});

test('claim code: picks the one live token, refuses expired or ambiguous codes', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  const live = { id: 'a', expiresAt: new Date('2026-10-23T10:05:00Z') };
  const old = { id: 'b', expiresAt: new Date('2026-10-23T09:00:00Z') };
  assert.deepEqual(pickClaimToken([], now), { ok: false, reason: 'not-found' });
  assert.deepEqual(pickClaimToken([old], now), { ok: false, reason: 'expired' });
  assert.deepEqual(pickClaimToken([old, live], now), { ok: true, id: 'a' });   // the old code no longer hides the live one
  assert.deepEqual(pickClaimToken([live, { ...live, id: 'c' }], now), { ok: false, reason: 'ambiguous' });
  assert.deepEqual(pickClaimToken([{ id: 'd', expiresAt: null }], now), { ok: true, id: 'd' });   // no expiry = never expires
});
