// Run with: npm test. The counter's code check and the new-redemption alert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, checkCode, freshPending, isExpired, claimRefusal } from './redemptions.ts';

const now = new Date('2026-11-06T12:00:00Z');
const r = (code: string, status: 'pending' | 'claimed', daysAgo: number, id = code) => ({
  id, redemptionCode: code, status, redeemedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  userId: 'u', userEmail: 'a@b.c', rewardId: 'x', rewardTitle: 'Iced Latte', pointsUsed: 100,
});

test('codes are read the way staff type them: any case, spaces or dashes', () => {
  assert.equal(normalizeCode(' ab12-cd 34 '), 'AB12CD34');
  assert.equal(normalizeCode('ab12 cd34'), 'AB12CD34');
});

test('a full code gets a verdict: valid, already handed out, expired, or not found', () => {
  const list = [r('AB12CD34', 'pending', 1), r('ZZ99ZZ99', 'claimed', 2), r('OLD00OLD', 'pending', 8)];
  assert.equal(checkCode('ab12 cd34', list, now).kind, 'valid');
  assert.equal(checkCode('ab12 cd34', list, now).redemption?.id, 'AB12CD34');
  assert.equal(checkCode('ZZ99ZZ99', list, now).kind, 'claimed');
  assert.equal(checkCode('OLD00OLD', list, now).kind, 'expired');
  assert.equal(checkCode('NOPE0000', list, now).kind, 'notFound');
  assert.equal(checkCode('AB12', list, now).kind, 'partial', 'still typing');
  assert.equal(checkCode('', list, now).kind, 'empty');
});

test('a code is redeemable for exactly 7 days, like the app says', () => {
  assert.equal(isExpired(r('A', 'pending', 6.9), now), false);
  assert.equal(isExpired(r('A', 'pending', 7.1), now), true);
  assert.equal(isExpired(r('A', 'claimed', 30), now), false, 'a handed-out code is claimed, not expired');
});

test('the hand-out re-check refuses anything but a live pending code', () => {
  assert.equal(claimRefusal(r('A', 'pending', 1), now), null);
  assert.match(claimRefusal(r('A', 'claimed', 1), now)!, /already handed out/);
  assert.match(claimRefusal(r('A', 'pending', 8), now)!, /expired/);
  assert.match(claimRefusal(undefined, now)!, /no longer exists/);
});

test('only redemptions that arrive after the first load raise an alert, each once', () => {
  const seen = new Set<string>();
  assert.deepEqual(freshPending(seen, [r('A', 'pending', 0)], true), [], 'the first load seeds, no alert');
  const next = [r('A', 'pending', 0), r('B', 'pending', 0), r('C', 'claimed', 0)];
  assert.deepEqual(freshPending(seen, next, false).map(x => x.id), ['B']);
  assert.deepEqual(freshPending(seen, next, false), [], 'never twice');
});
