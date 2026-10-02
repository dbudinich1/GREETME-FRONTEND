// Fixture-only checks of the REAL SendGreeting page for the two narrow Surface 3 edits (no real send/charge:
// the whole API is mocked with page.route; the dev server points at http://127.0.0.1:8099 which nothing serves).
//   1. the QR Cash attachment summary row says what the sender pays and that nothing is charged yet;
//   2. the referral banner shows the server-issued credit amount, never a literal.
// Run: npx playwright test -c playwright.sendgreeting-s3.config.js
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.S3_CAPTURE_DIR || 'test-results/sendgreeting-s3';
const USER = { id: 'u-s3', name: 'Alex Fixture', email: 'alex@example.com', photoUrl: 'https://example.com/alex.jpg', emailVerified: true, plan: 'free', tier: 'free', personalizationComplete: true };
const CONTACT = { id: 'c-s3', name: 'Jamie Recipient', email: 'jamie@example.com' };

async function seed(page, { referral = null } = {}) {
  await page.addInitScript(([u]) => { localStorage.setItem('token', 'fixture-token'); localStorage.setItem('user', JSON.stringify(u)); }, [USER]);
  page.mutations = [];
  await page.route('http://127.0.0.1:8099/api/**', (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() !== 'GET') { page.mutations.push(`${req.method()} ${url}`); }
    if (/\/api\/contacts$/.test(url) && req.method() === 'GET') return route.fulfill({ json: { contacts: [CONTACT] } });
    if (/\/api\/profile$/.test(url)) return route.fulfill({ json: { profile: { ...USER } } });
    if (/\/api\/hearts\/balance$/.test(url)) return route.fulfill({ json: { balance: 0 } });
    if (/\/api\/gifts\/referral\//.test(url) && referral) return route.fulfill({ json: { ok: true, ...referral } });
    if (/\/api\/entitlements\/send-preflight$/.test(url)) return route.fulfill({ json: { canSendGreeting: true } });
    if (/\/api\/wallet$/.test(url)) return route.fulfill({ json: { ok: true, wallet: { unmetered: false, totalSpendableNow: 0, monthly: { remaining: 0, cap: 3 }, anytime: { available: 0, includedCap: 0 }, banked: { available: 0, cap: 0 }, purchased: { animationCredits: 0, spendable: true } } } });
    return route.fulfill({ json: { ok: true } });
  });
}
async function openComposer(page, search = '') {
  await page.goto(`/#/dashboard/send${search}`);
  await expect(page.locator('select[name="contactId"]')).toBeVisible({ timeout: 90000 });
  await page.locator('select[name="contactId"]').selectOption(CONTACT.id);
  await page.locator('select[name="occasionType"]').selectOption('Birthday');
}
async function chooseQrCash(page) {
  await page.getByRole('button', { name: /Add a Gift \(Optional\)|Edit Gift/ }).click();
  await page.locator('input[type="radio"][value="qrcash"]').check();   // applies the QR Cash attachment (default $25)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`QR Cash summary row @${w}: shows what you pay, nothing charged yet, Remove intact`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seed(page);
    await openComposer(page);
    await chooseQrCash(page);
    const row = process.env.S3_BEFORE === '1' ? page.getByText('Gift: QR Cash ($25)') : page.getByTestId('qrcash-summary-line');
    await expect(row).toContainText('Gift: QR Cash ($25)');
    const pay = page.getByTestId('qrcash-summary-pay');   // absent in the before run (testid is new)
    if (process.env.S3_BEFORE === '1') {
      await expect(pay).toHaveCount(0);
    } else {
      await expect(pay).toHaveText('You pay $27.74. Nothing is charged until you confirm.');
    }
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();
    fs.mkdirSync(OUT, { recursive: true });
    await row.scrollIntoViewIfNeeded();
    await row.locator('xpath=ancestor::div[contains(@style,"background")][1]').screenshot({ path: `${OUT}/summary-row-${w}.png` });
    expect(page.mutations).toEqual([]);
  });
}

test('referral banner shows the server-issued credit amount, no literal $10', async ({ page }) => {
  for (const [cents, expected] of [[500, '$5'], [1000, '$10'], [750, '$7.50']]) {
    await seed(page, { referral: { referralCreditCents: cents, valid: true, referrerName: 'Pat' } });
    await page.goto(`/#/dashboard/send?referral=ABC${cents}`);
    const banner = page.getByText('Greet-Me Credit Applied');
    await expect(banner).toBeVisible({ timeout: 90000 });
    await expect(banner).toContainText(`${expected} Greet-Me Credit Applied`);
    await expect(page.getByText(`Your ${expected} credit has been applied`)).toBeVisible();
    await page.unrouteAll();
  }
});


