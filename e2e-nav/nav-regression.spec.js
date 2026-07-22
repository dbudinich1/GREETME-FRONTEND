// NAV-03 regression guard — FOR BUSINESS must be a SPLIT control:
//   • the label is a navigable link to the ORIGINAL /business page;
//   • a SEPARATE caret button opens/closes the Corporate Campaign Dashboard submenu.
// This test FAILS if For Business ever becomes dropdown-only again (label no longer a link),
// and it asserts the separate submenu expansion. Offline, stubbed, zero-mutation.
import { test, expect } from '@playwright/test';

const USER = { id: 'nav-e2e', email: 'nav@example.com', name: 'Nav Tester', plan: 'free', tier: 'free', emailVerified: true };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => {
    try {
      localStorage.setItem('token', 'nav-fake');
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('greetme_onboarding_completed', 'true');
      localStorage.setItem('greetme_onboarding_v1_completed', 'true');
    } catch {}
  }, USER);
  await page.route('http://127.0.0.1:8099/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) }));
});

test('desktop: For Business label navigates to /business; caret alone opens submenu → /dashboard/campaigns', async ({ page }) => {
  await page.goto('/#/dashboard/fundraiser');
  const nav = page.locator('nav').first();
  await nav.waitFor();

  // REGRESSION GUARD — For Business is a navigable LINK (not a dropdown-only button)
  const fbLink = nav.getByRole('link', { name: 'For Business', exact: true });
  await expect(fbLink).toBeVisible();
  // and a SEPARATE caret button exists with an accurate accessible label
  await expect(nav.getByRole('button', { name: 'Open For Business menu' })).toBeVisible();

  // 1+2+6. Clicking the LABEL opens the exact original route + page (not the submenu)
  await fbLink.click();
  await expect(page).toHaveURL(/\/#\/business$/);
  await expect(page.getByRole('heading', { name: /Create branded gifts to acknowledge your clients and employees/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Corporate Campaign Dashboard' })).toHaveCount(0); // label did NOT open submenu

  // 3. Clicking ONLY the caret opens the submenu WITHOUT navigating
  const urlBefore = page.url();
  await nav.getByRole('button', { name: 'Open For Business menu' }).click();
  const ccd = page.getByRole('menuitem', { name: 'Corporate Campaign Dashboard' });
  await expect(ccd).toBeVisible();                                   // 4. submenu contains it
  expect(page.url()).toBe(urlBefore);                               // 5(neg). no navigation on open
  await expect(nav.getByRole('button', { name: 'Close For Business menu' })).toBeVisible(); // aria toggled

  // 5. Selecting the child opens /dashboard/campaigns
  await ccd.click();
  await expect(page).toHaveURL(/\/#\/dashboard\/campaigns$/);

  // 6. Returning + clicking the label still opens the original page
  await nav.getByRole('link', { name: 'For Business', exact: true }).click();
  await expect(page).toHaveURL(/\/#\/business$/);
});

test('desktop: keyboard — label & caret are independent focus stops; Enter opens; Escape closes', async ({ page }) => {
  await page.goto('/#/dashboard/fundraiser');
  const nav = page.locator('nav').first();
  const fbLink = nav.getByRole('link', { name: 'For Business', exact: true });
  await fbLink.focus();
  await expect(fbLink).toBeFocused();                                // 8. label reachable
  await page.keyboard.press('Tab');                                 // 8. caret is a separate stop
  const caret = nav.getByRole('button', { name: /For Business menu/ });
  await expect(caret).toBeFocused();
  await page.keyboard.press('Enter');                              // 9. Enter opens
  await expect(page.getByRole('menuitem', { name: 'Corporate Campaign Dashboard' })).toBeVisible();
  await page.keyboard.press('Escape');                            // 10. Escape closes
  await expect(page.getByRole('menuitem', { name: 'Corporate Campaign Dashboard' })).toHaveCount(0);
});

test('desktop: unrelated nav intact — Greet-Me Fundraise + Media Library relocation unchanged', async ({ page }) => {
  await page.goto('/#/dashboard/fundraiser');
  const nav = page.locator('nav').first();
  await expect(nav.getByRole('link', { name: 'Greet-Me Fundraise' })).toBeVisible();   // 11
  await expect(page.getByText('Fundraising is not currently enabled')).toBeVisible();  // 11 dormant unchanged
  await expect(nav.getByText('Media Library', { exact: true })).toHaveCount(0);        // 12
  await page.getByTitle('Nav Tester').click();
  await expect(page.getByRole('button', { name: 'Media Library' })).toBeVisible();     // 12
});

test('mobile: For Business row — label navigates; SEPARATE caret expands children (not expand-only)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/#/dashboard/fundraiser');
  await page.locator('header button').first().click();              // open mobile drawer (hamburger)
  const caret = page.getByRole('button', { name: 'Open For Business menu' });
  await expect(caret).toBeVisible();
  // 7. child hidden until the caret expands it (row is NOT expand-only)
  await expect(page.getByRole('link', { name: 'Corporate Campaign Dashboard' })).toHaveCount(0);
  await caret.click();
  await expect(page.getByRole('link', { name: 'Corporate Campaign Dashboard' })).toBeVisible();
  // 7. the label still navigates to the original /business page
  await page.getByRole('link', { name: 'For Business', exact: true }).click();
  await expect(page).toHaveURL(/\/#\/business$/);
});
