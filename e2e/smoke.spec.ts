// Browser smoke test against the local emulators (audit 8.3: C-05 soak, H-08 one row per scan, M-17, M-05).
import { test, expect, type Page } from '@playwright/test';
import { ADMIN, CUSTOMER, SCANS } from './fixtures';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('admin@ecoreward.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('admin: dashboard survives a 20 s soak; Scan History shows one row per scan; leaderboard loads', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'ECOReward Dashboard' })).toBeVisible();

  // C-05: pages used to replace their content with "Failed to load" 15 s after mounting.
  await page.waitForTimeout(20_000);
  await expect(page.getByText(/Failed to load/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ECOReward Dashboard' })).toBeVisible();

  // H-08: two scans must be two rows (merging waste_logs used to show four).
  await page.getByRole('link', { name: 'Scan History' }).click();
  await expect(page).toHaveURL(/\/scan-history$/);
  await expect(page.getByText(`${SCANS} total scans`)).toBeVisible();
  await expect(page.locator('button', { hasText: 'after generation' })).toHaveCount(SCANS);

  await page.getByRole('link', { name: 'Leaderboard' }).click();
  await expect(page.getByText(CUSTOMER.username).first()).toBeVisible();
  await expect(page.getByText(/Failed to load/)).toHaveCount(0);
});

test('a customer account cannot open the admin console', async ({ page }) => {
  await signIn(page, CUSTOMER.email, CUSTOMER.password);
  await expect(page.getByText('Access denied. Admin accounts only.')).toBeVisible();
  await expect(page).not.toHaveURL(/\/dashboard/);
});

test('a wrong password gets a neutral message, not raw Firebase text (M-17)', async ({ page }) => {
  await signIn(page, ADMIN.email, 'wrong-password');
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
  await expect(page.getByText(/auth\//)).toHaveCount(0);
});

test('security headers are sent (M-05)', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['x-robots-tag']).toContain('noindex');
  expect(res.headers()['x-powered-by']).toBeUndefined();
});
