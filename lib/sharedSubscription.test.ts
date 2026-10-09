import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { shareSubscription } from './sharedSubscription.ts';

function fakeSource() {
  const state = { starts: 0, stops: 0, emit: (_v: number) => {}, fail: (_e: unknown) => {} };
  const start = (onData: (v: number) => void, onError: (e: unknown) => void) => {
    state.starts++;
    state.emit = onData;
    state.fail = onError;
    return () => { state.stops++; };
  };
  return { state, start };
}

test('one listener for many subscribers; late subscribers get the cached value at once', () => {
  const { state, start } = fakeSource();
  const sub = shareSubscription(start);
  const a: number[] = [], b: number[] = [];
  sub(v => a.push(v));
  state.emit(1);
  sub(v => b.push(v));               // second page: no new listener, cached value delivered
  state.emit(2);
  assert.equal(state.starts, 1);
  assert.deepEqual(a, [1, 2]);
  assert.deepEqual(b, [1, 2]);
});

test('navigating away and back within the idle window does not re-open the listener', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { state, start } = fakeSource();
    const sub = shareSubscription(start, 1000);
    const off = sub(() => {});
    state.emit(7);
    off();
    mock.timers.tick(500);
    const seen: number[] = [];
    sub(v => seen.push(v));
    assert.deepEqual(seen, [7]);
    assert.equal(state.starts, 1);
    assert.equal(state.stops, 0);
  } finally { mock.timers.reset(); }
});

test('the listener closes after the idle window with no subscribers, and reopens on demand', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { state, start } = fakeSource();
    const sub = shareSubscription(start, 1000);
    const off = sub(() => {});
    off();
    off();                            // double unsubscribe is harmless
    mock.timers.tick(1000);
    assert.equal(state.stops, 1);
    sub(() => {});
    assert.equal(state.starts, 2);
  } finally { mock.timers.reset(); }
});

test('a listener error resets it so the next subscriber retries', () => {
  const { state, start } = fakeSource();
  const sub = shareSubscription(start);
  const errors = mock.method(console, 'error', () => {});
  sub(() => {});
  state.fail(new Error('permission-denied'));
  assert.equal(state.stops, 1);
  sub(() => {});
  assert.equal(state.starts, 2);
  errors.mock.restore();
});
