// The counter: a customer redeems in the app, staff are alerted, check the code and hand the reward out once.
import { test, expect } from '@playwright/test';
import { ADMIN, PROJECT } from './fixtures';

const FS = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents`;
// "Bearer owner" is the emulator's admin bypass; it does not exist in production.
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function redeem(id: string, code: string, daysAgo = 0) {
  const fields = {
    userId: { stringValue: 'phone-user' }, userEmail: { stringValue: 'bea@e2e.test' }, rewardId: { stringValue: 'latte' },
    rewardTitle: { stringValue: 'Iced Latte' }, pointsUsed: { integerValue: '120' }, status: { stringValue: 'pending' },
    redemptionCode: { stringValue: code }, redeemedAt: { timestampValue: new Date(Date.now() - daysAgo * 86_400_000).toISOString() },
  };
  const r = await fetch(`${FS}/redemptions?documentId=${id}`, { method: 'POST', headers: OWNER, body: JSON.stringify({ fields }) });
  expect(r.ok, await r.text()).toBe(true);
}

test('a new redemption alerts staff, the code checks out once, then reads as already handed out', async ({ page }) => {
  await redeem('old-code', 'OLDC0DE1', 9);
  await redeem('waiting-code', 'WA17ING1', 1);   // already waiting when staff sign in: counted, not announced
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByLabel(/codes? waiting/)).toHaveText('1');   // the live feed has loaded
  await expect(page.getByText('New redemption:')).toHaveCount(0);

  // A customer redeems while staff are on the dashboard.
  await redeem('new-code', 'AB12CD34');
  await expect(page.getByText('New redemption: Iced Latte')).toBeVisible();
  await expect(page.getByLabel(/codes? waiting/)).toHaveText('2');
  await expect(page.getByRole('link', { name: /Rewards to hand out\s*2\s*Waiting at the counter/ })).toBeVisible();

  // The toast opens the code check with that code filled in.
  await page.getByRole('link', { name: 'Check this code' }).click();
  await expect(page.getByText('Valid: give them Iced Latte')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Mark as Claimed' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mark as claimed' }).click();
  await expect(page.getByText('"Iced Latte" marked as claimed')).toBeVisible();

  // The same code a second time, typed the way a person might.
  await page.getByLabel("Check a customer's code").fill('ab12-cd34');
  await expect(page.getByText('Already handed out')).toBeVisible();

  await page.getByLabel("Check a customer's code").fill('OLDC0DE1');
  await expect(page.getByRole('status').getByText('Expired', { exact: true })).toBeVisible();

  await page.getByLabel("Check a customer's code").fill('ZZZZ9999');
  await expect(page.getByText('No reward has this code')).toBeVisible();

  const doc = await (await fetch(`${FS}/redemptions/new-code`, { headers: OWNER })).json();
  expect(doc.fields.status.stringValue).toBe('claimed');

  // Another customer redeems while staff are already on Rewards: the alert's link must still open that code.
  await redeem('second-code', 'QW34ER56');
  await page.getByRole('link', { name: 'Check this code' }).click();
  await expect(page.getByLabel("Check a customer's code")).toHaveValue('QW34ER56');
  await expect(page.getByText('Valid: give them Iced Latte')).toBeVisible();
});
