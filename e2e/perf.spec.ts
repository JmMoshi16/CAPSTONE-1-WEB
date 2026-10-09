// Performance measurement (audit Phase 9). Runs only with `npm run perf` (large seed, see global-setup).
// For each admin page: billed Firestore reads (counted by the test build) and time until content shows,
// both for a cold visit (fresh browser) and when navigating from the dashboard (shared listeners).
import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { ADMIN } from './fixtures';

test.skip(process.env.E2E_SEED !== 'load', 'performance run only (npm run perf)');
test.setTimeout(240_000);

const PAGES: { path: string; link: string; ready: RegExp | string }[] = [
  { path: '/dashboard', link: 'Dashboard', ready: 'ECOReward Dashboard' },
  { path: '/analytics', link: 'Analytics', ready: 'Advanced Analytics' },
  { path: '/users', link: 'Users', ready: 'Customer Management' },
  { path: '/scan-history', link: 'Scan History', ready: /total scans/ },
  { path: '/leaderboard', link: 'Leaderboard', ready: /ranked by lifetime points/ },
  { path: '/rewards', link: 'Rewards & Redemptions', ready: 'Rewards Manager' },
];

const reads = (page: Page) => page.evaluate(() => (window as unknown as { __ecoReads?: number }).__ecoReads ?? 0);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('admin@ecoreward.com').fill(ADMIN.email);
  await page.getByPlaceholder('••••••••').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

test('reads and time-to-content per page', async ({ browser }) => {
  const rows: { page: string; coldReads: number; coldMs: number; navReads: number; navMs: number }[] = [];

  // Cold: a fresh browser per page (worst case: someone opens the page directly).
  for (const p of PAGES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page);
    const t0 = Date.now();
    if (p.path !== '/dashboard') await page.goto(p.path);   // full load: the read counter restarts at 0
    await expect(page.getByText(p.ready).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);   // let late snapshots arrive
    rows.push({ page: p.path, coldReads: await reads(page), coldMs: Date.now() - t0, navReads: 0, navMs: 0 });
    await ctx.close();
  }

  // Navigation: one session, dashboard first, then every page through the sidebar.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page);
  for (const p of PAGES) {
    const before = await reads(page), t0 = Date.now();
    if (p.path !== '/dashboard') await page.getByRole('link', { name: p.link, exact: true }).click();
    await expect(page.getByText(p.ready).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    const row = rows.find(r => r.page === p.path)!;
    row.navReads = (await reads(page)) - (p.path === '/dashboard' ? 0 : before);
    row.navMs = Date.now() - t0;
  }
  await ctx.close();

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/perf.json', JSON.stringify(rows, null, 2));
  console.log('\npage            cold reads  cold ms   nav reads  nav ms');
  for (const r of rows) console.log(`${r.page.padEnd(15)} ${String(r.coldReads).padStart(10)} ${String(r.coldMs).padStart(8)} ${String(r.navReads).padStart(10)} ${String(r.navMs).padStart(7)}`);
});
