// Audit C-05: pages flipped to "Failed to load" 15 s after mounting even though their data had
// arrived, because the timer closed over the first render's state. This renders a real component
// with React and fake timers. HOOK_FILE lets tools/break_restore.py point it at a broken copy.
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { useLoadTimeout } = await import(process.env.HOOK_FILE ?? './useLoadTimeout.ts');

let shown: boolean[] = [];
function Page({ loading }: { loading: boolean }) {
  const error = useLoadTimeout(loading, 15_000);
  shown.push(error);
  return createElement('div', null, error ? 'Failed to load' : loading ? 'Loading' : 'Content');
}
const text = (r: ReactTestRenderer) => (r.toJSON() as { children: string[] }).children[0];

beforeEach(() => { shown = []; mock.timers.enable({ apis: ['setTimeout'] }); });
afterEach(() => { mock.timers.reset(); });

test('data that arrives in time keeps the page showing content after 20 s', () => {
  let r!: ReactTestRenderer;
  act(() => { r = TestRenderer.create(createElement(Page, { loading: true })); });
  act(() => { mock.timers.tick(2_000); });
  act(() => { r.update(createElement(Page, { loading: false })); });   // the subscription delivered
  act(() => { mock.timers.tick(20_000); });
  assert.equal(text(r), 'Content');
  assert.ok(!shown.slice(-1)[0]);
});

test('data that never arrives shows the error after the timeout, not before', () => {
  let r!: ReactTestRenderer;
  act(() => { r = TestRenderer.create(createElement(Page, { loading: true })); });
  act(() => { mock.timers.tick(14_000); });
  assert.equal(text(r), 'Loading');
  act(() => { mock.timers.tick(1_500); });
  assert.equal(text(r), 'Failed to load');
});

test('late data recovers the page instead of leaving it on the error screen', () => {
  let r!: ReactTestRenderer;
  act(() => { r = TestRenderer.create(createElement(Page, { loading: true })); });
  act(() => { mock.timers.tick(16_000); });
  assert.equal(text(r), 'Failed to load');
  act(() => { r.update(createElement(Page, { loading: false })); });
  assert.equal(text(r), 'Content');
});
