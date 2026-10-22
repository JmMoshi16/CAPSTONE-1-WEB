// Manual Claim: duplicate usernames are chosen by email, an expired twin code does not hide the live one,
// and the credit is a full scan credit (scan count, streak, badges), like the phone app.
import { test, expect } from '@playwright/test';
import { ADMIN, PROJECT } from './fixtures';

const DOC = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents`;
async function read(path: string) {
  // "Bearer owner" is the emulator's admin bypass; it does not exist in production.
  const r = await fetch(`${DOC}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return (await r.json()).fields as Record<string, { integerValue?: string; booleanValue?: boolean; arrayValue?: { values?: { stringValue: string }[] } }>;
}

test('manual claim: choose sam by email, credit like a phone scan', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Manual Claim' }).click();
  await page.getByPlaceholder('e.g. ECO-4829').fill('ECO-4321');
  await page.getByPlaceholder('e.g. juandelacruz').fill('sam');
  await page.getByRole('button', { name: 'Find Account' }).click();

  await expect(page.getByText('2 customers are called')).toBeVisible();
  await page.getByRole('button', { name: /sam2@e2e\.test/ }).click();
  await page.getByRole('button', { name: /Confirm & Credit/ }).click();

  await expect(page.getByText('Points Credited!')).toBeVisible();
  await expect(page.getByText('+15')).toBeVisible();              // Biodegradable, streak 1 -> 1x
  await expect(page.getByText(/5 Scans/)).toBeVisible();          // the 5th scan unlocks the badge, as in the app

  const sam2 = await read('users/sam2');
  expect(sam2.points.integerValue).toBe('15');
  expect(sam2.scanCount.integerValue).toBe('5');
  expect(sam2.streak.integerValue).toBe('1');
  expect(sam2.badges.arrayValue?.values?.map(v => v.stringValue)).toContain('scan_5');
  expect((await read('users/sam1')).points.integerValue).toBe('0');   // the other sam is untouched
  expect((await read('qr_tokens/claim-live')).isUsed.booleanValue).toBe(true);
  expect((await read('qr_tokens/claim-old')).isUsed.booleanValue).toBe(false);
});
