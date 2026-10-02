// Fixture-only check of the REAL Recipients "Add recipient" form (mocked API, no real contact/send/charge).
// Captures the QR Cash gift block. Run: npx playwright test -c playwright.contactform-qrcash.config.js
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.QC_CAPTURE_DIR || 'test-results/contactform-qrcash';
const USER = { id: 'u-qc', name: 'Alex Fixture', email: 'alex@example.com', photoUrl: 'https://example.com/alex.jpg', emailVerified: true, plan: 'free', tier: 'free', personalizationComplete: true };

for (const [w, h] of [[1440, 1000], [390, 900]]) {
  test(`QR Cash gift block @${w}: Auto-Gift off, Manual Selection, honest sentence`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    page.mutations = [];
    await page.addInitScript(([u]) => { localStorage.setItem('token', 'fixture-token'); localStorage.setItem('user', JSON.stringify(u)); }, [USER]);
    await page.route('http://127.0.0.1:8099/api/**', (route) => {
      const req = route.request(); const url = req.url();
      if (req.method() !== 'GET') page.mutations.push(`${req.method()} ${url}`);
      if (/\/api\/contacts(\?.*)?$/.test(url) && req.method() === 'GET') return route.fulfill({ json: { contacts: [] } });
      if (/\/api\/profile$/.test(url)) return route.fulfill({ json: { profile: { ...USER } } });
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto('/#/dashboard/contacts', { waitUntil: 'commit', timeout: 120000 });
    await page.getByRole('button', { name: /add (a )?(new )?(recipient|person)|\+ ?add/i }).first().click({ timeout: 90000 });
    await page.getByTestId('special-occasions-toggle').click();
    await page.locator('#occasion-birthday').check();
    await page.getByTestId('add-gift-birthday').check();
    await page.getByTestId('gift-selector-birthday').selectOption('qrcash');
    const box = page.getByTestId('autogift-qrcash-probe');
    const toggle = page.locator('label', { hasText: 'Enable Auto-Gift' }).locator('input[type="checkbox"]').first();
    if (process.env.QC_BEFORE === '1') {
      await expect(toggle).toBeEnabled();
      await expect(page.getByText('QR Cash is sent when you send the Greet-Me.')).toHaveCount(0);
    } else {
      await expect(toggle).toBeDisabled();
      await expect(toggle).not.toBeChecked();
      await expect(page.getByText('Manual Selection').first()).toBeVisible();
      await expect(page.getByText('QR Cash is sent when you send the Greet-Me. Scheduled QR Cash is not available yet.')).toBeVisible();
    }
    fs.mkdirSync(OUT, { recursive: true });
    await page.getByTestId('add-gift-row-birthday').scrollIntoViewIfNeeded();
    await page.getByTestId('add-gift-row-birthday').locator('xpath=ancestor::div[contains(@style,"border-radius")][1]').screenshot({ path: `${OUT}/qrcash-gift-block-${w}.png` });
    expect(page.mutations).toEqual([]);
  });
}
