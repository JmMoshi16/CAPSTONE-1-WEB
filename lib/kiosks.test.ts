// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKioskOnline, fillState, groupByKiosk } from './kiosks.ts';

const now = new Date('2026-10-23T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

test('kiosk is online only with status online and a heartbeat within 2 minutes', () => {
  assert.equal(isKioskOnline({ status: 'online', lastSeen: ago(30_000) }, now), true);
  assert.equal(isKioskOnline({ status: 'online', lastSeen: ago(121_000) }, now), false); // crashed: no clean "offline"
  assert.equal(isKioskOnline({ status: 'offline', lastSeen: ago(1_000) }, now), false);  // clean exit
  assert.equal(isKioskOnline({ status: 'online', lastSeen: '' }, now), false);
});

test('fill state uses the kiosk thresholds: warn at 90, full (kiosk paused) at 100', () => {
  assert.equal(fillState(89, 90, 100), 'ok');
  assert.equal(fillState(90, 90, 100), 'warn');
  assert.equal(fillState(100, 90, 100), 'full');
});

test('bins group under their kiosk in Bio / Rec / Res order; fill is clamped', () => {
  const bins = [
    { binId: 'kiosk-a-res', location: 'A · Residual', fillLevel: 120, status: 'online' as const, lastUpdated: ago(3_600_000) },
    { binId: 'kiosk-a-bio', location: 'A · Biodegradable', fillLevel: 40, status: 'online' as const, lastUpdated: ago(3_600_000) },
  ];
  const kiosks = [{ kioskId: 'kiosk-a', name: 'Cafe PC', status: 'online' as const, lastSeen: ago(10_000) }];
  const [g] = groupByKiosk(bins, kiosks, now);
  assert.equal(g.name, 'Cafe PC');
  assert.equal(g.online, true); // an hour-old fill level is fine while the heartbeat is fresh
  assert.deepEqual(g.bins.map(b => [b.wasteType, b.fill]), [['Biodegradable', 40], ['Residual', 100]]);
});

test('bins without a kiosk document fall back to their own lastUpdated (10 minutes)', () => {
  const bin = (id: string, age: number) => ({ binId: `${id}-rec`, location: '', fillLevel: 5, status: 'online' as const, lastUpdated: ago(age) });
  const groups = groupByKiosk([bin('old', 11 * 60_000), bin('new', 60_000)], [], now);
  assert.deepEqual(groups.map(g => [g.kioskId, g.online]), [['new', true], ['old', false]]);
});

test('a kiosk with no bins yet still shows up', () => {
  const groups = groupByKiosk([], [{ kioskId: 'k', name: '', status: 'online', lastSeen: ago(0) }], now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'k');
  assert.deepEqual(groups[0].bins, []);
});
