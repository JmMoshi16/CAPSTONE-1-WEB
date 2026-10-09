// Run with: npm test   (node --test, Node 24 strips the TypeScript types itself)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCSV } from './csv.ts';
import { toDate, toIso, fmtDate, fmtAgo, timeOf, dayKey, isOlderThanDays } from './dates.ts';

test('redemption expiry: 7 days after redeemedAt; unknown dates never expire', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  assert.equal(isOlderThanDays('2026-10-02T12:00:01Z', 7, now), false); // 7 days minus 1 s
  assert.equal(isOlderThanDays('2026-10-02T11:59:59Z', 7, now), true);
  assert.equal(isOlderThanDays('', 7, now), false);
  assert.equal(isOlderThanDays(undefined, 7, now), false);
});

test('csv: RFC 4180 quoting', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(null), '');
  assert.equal(toCSV([{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }]), 'a,b\r\n1,x\r\n2,"y,z"\r\n');
});

test('csv: formula injection is neutralised in text cells only', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('-cmd'), "'-cmd");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(-5), '-5'); // a real negative number stays a number
});

test('dates: every stored format, never throws', () => {
  const ts = { toDate: () => new Date('2026-10-09T01:00:00Z') };
  assert.equal(toIso(ts), '2026-10-09T01:00:00.000Z');
  assert.equal(toIso({ seconds: 1791507600, nanoseconds: 0 }), new Date(1791507600 * 1000).toISOString());
  assert.equal(toIso('2026-10-09T01:00:00.000Z'), '2026-10-09T01:00:00.000Z');
  assert.ok(toDate('2026-10-09T09:00:00.000')); // Flutter local ISO without offset
  for (const bad of [undefined, null, '', 'garbage', {}, NaN]) {
    assert.equal(toDate(bad), null);
    assert.equal(fmtDate(bad, 'MMM d, yyyy'), '—');
    assert.equal(fmtAgo(bad), '—');
    assert.equal(timeOf(bad), 0);
    assert.equal(dayKey(bad), null);
  }
});
