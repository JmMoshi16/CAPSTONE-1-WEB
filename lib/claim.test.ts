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
  assert.deepEqual(c.newBadges.sort(), ['pts_100', 'scan_5', 'streak_3']);
  assert.equal(c.badgeBonus, 30);             // 10 + 10 + 10, paid once on top of the scan
  assert.deepEqual([c.points, c.lifetimePoints, c.scanCount], [78, 133, 5]);
  assert.equal(c.lastScanDate, '2026-10-23');
  assert.deepEqual(c.badges.slice(0, 1), ['first_scan']);
});

test('badge bonuses: the same table as the app, 140 in all', () => {
  const bonus = Object.fromEntries(RULES.badges.map((b: { id: string; bonus: number }) => [b.id, b.bonus]));
  assert.deepEqual(bonus, { first_scan: 5, scan_5: 10, scan_10: 15, scan_25: 20, scan_50: 25,
    pts_50: 5, pts_100: 10, pts_500: 20, streak_3: 10, streak_7: 20 });
});

test('badge bonus: a held badge pays nothing again; the rarest pile-up stays within the +100 rule bound', () => {
  const held = creditScan({ points: 30, scanCount: 5, badges: ['first_scan', 'scan_5'] }, 5, day('2026-10-23'), RULES);
  assert.equal(held.badgeBonus, 0);
  assert.equal(held.points, 35);
  const all = RULES.badges.map((b: { id: string }) => b.id).filter((id: string) => !['scan_50', 'pts_500', 'streak_7'].includes(id));
  const pile = creditScan({ points: 100, lifetimePoints: 480, scanCount: 49, streak: 6, lastScanDate: '2026-10-22', badges: all },
    15, day('2026-10-23'), RULES);
  assert.equal(pile.awarded, 30);
  assert.equal(pile.badgeBonus, 65);
  assert.ok(pile.awarded + pile.badgeBonus <= 100);
  assert.equal(pile.lifetimePoints, 575);
});

test('badge bonus is capped where scan plus bonus would pass +100', () => {
  const rules = { ...RULES, badges: [{ id: 'big', req: 'scans', value: 1, bonus: 90 }] };
  const c = creditScan({ points: 0 }, 15, day('2026-10-23'), rules);
  assert.equal(c.badgeBonus, 85);
  assert.equal(c.points, 100);
});

test('credit: older documents without lifetimePoints start from the balance', () => {
  const c = creditScan({ points: 30 }, 10, day('2026-10-23'), RULES);
  assert.deepEqual([c.points, c.lifetimePoints, c.scanCount, c.streak], [45, 45, 1, 1]);   // 30 + 10 + First Scan's 5
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
