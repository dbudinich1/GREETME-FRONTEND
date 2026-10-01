// tests/closeout1c.spec.js - Team 1C (Corporate / founder FE) fixture specs.
// Fully isolated: every /api/** call is answered from fixtures; any non-GET the spec did not
// explicitly expect is recorded and asserted absent. No real campaign, economics, payout, referral
// or salesperson mutation is ever sent.
//
// Proposed:  npx playwright test -c playwright.closeout1c.config.js            (preview on 5233)
// Current:   BASE_URL=http://127.0.0.1:5238 LABEL=current npx playwright test -c playwright.closeout1c.config.js -g render
import { test, expect } from '@playwright/test';

const OUT = 'C:/1_GREET-ME/reports/closeout-sprint/render-review/assets-1c';
const LABEL = process.env.LABEL || 'proposed';
const API = 'http://127.0.0.1:8099';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const USER = { id: 'u1', name: 'Alex Fixture', email: 'alex.fixture@example.com', emailVerified: true, plan: 'free', tier: 'free', personalizationComplete: true };
const FOUNDER = { ...USER, plan: 'founder', tier: 'founder' };

let writes;
async function setup(page, user) {
  writes = [];
  await page.addInitScript((u) => {
    localStorage.setItem('token', 'fixture-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
  await page.route(/google-analytics|googletagmanager|doubleclick/, (r) => r.abort());
  await page.route(`${API}/api/**`, (r) => {
    if (r.request().method() !== 'GET') writes.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
    return r.fulfill({ json: { ok: true } });
  });
  await page.route(`${API}/api/profile`, (r) => r.fulfill({ json: { profile: user } }));
}
const json = (page, pattern, body, status = 200) => page.route(pattern, (r) => {
  if (r.request().method() !== 'GET') writes.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
  return r.fulfill({ status, json: body });
});
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- corporate dashboard fixtures (W29 / W32) -------------------------------------------------
const ORG = 'org_1';
const CAMPAIGN = { campaignId: 'c1', name: 'Client Birthdays', enabled: false, approvalStatus: 'draft', lockStatus: 'unlocked', audienceRefs: [],
  deliveryConfig: { scheduleMode: 'contact_saved_date', occasionType: 'birthday' }, featuredSpreadConfig: {} };
async function corporateSetup(page, { createStatus = 200, createBody } = {}) {
  await setup(page, USER);
  const base = `${API}/api/corporate-campaigns`;
  await json(page, `${base}/memberships`, { ok: true, memberships: [{ corporateOrganizationId: ORG, role: 'owner', status: 'active' }] });
  await json(page, `${base}/organizations/${ORG}/campaigns`, { ok: true, campaigns: [CAMPAIGN], viewerAuthorization: { isCurrentOrganizationOwner: true } });
  await json(page, `${base}/organizations/${ORG}/contacts`, { ok: true, contacts: [{ id: 'e1', name: 'Bob Smith', corporateContactType: 'employee' }], count: 1 });
  await json(page, `${base}/organizations/${ORG}/campaigns/gift-catalog**`, { ok: true, items: [] });
  await page.route(`${base}/organizations/${ORG}/campaigns`, (r) => {
    if (r.request().method() === 'POST') {
      writes.push(`POST create ${r.request().postData()}`);
      return r.fulfill({ status: createStatus, json: createBody || { ok: true, campaign: { ...CAMPAIGN, campaignId: 'c2', name: 'New' } } });
    }
    return r.fulfill({ json: { ok: true, campaigns: [CAMPAIGN], viewerAuthorization: { isCurrentOrganizationOwner: true } } });
  });
}

for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  test(`render corporate create row and gift options ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await corporateSetup(page);
    await page.goto('/#/dashboard/campaigns');
    await expect(page.getByTestId('create-form')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${OUT}/${LABEL}-corporate-row-${name}.png`, fullPage: true });
    await page.getByTestId('card-open-c1').click();
    await page.getByTestId('card-tab-gift-c1').click();
    await page.getByTestId('selector-gift-c1').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${LABEL}-corporate-gift-${name}.png`, fullPage: true });
    if (LABEL === 'proposed') {
      // W29: no Greet-Me Gifts class; QR Cash visible but not selectable
      const gift = page.getByTestId('selector-gift-c1');
      await expect(gift).not.toContainText('Greet-Me Gifts');
      await expect(gift.locator('input[value="marketplace"]')).toHaveCount(0);
      await expect(gift.locator('input[value="qrcash"]')).toBeDisabled();
      await expect(gift.locator('input[value="curated"]')).toBeEnabled();
      if (vp.width < 600) expect(await overflowX(page)).toBeLessThanOrEqual(0); else test.info().annotations.push({ type: 'desktop-overflow-px', description: String(await overflowX(page)) });
    }
    expect(writes).toEqual([]);
  });
}

test('proposed W32: Create opens the details dialog; one POST; Type only there', async ({ page }) => {
  test.skip(LABEL !== 'proposed');
  await corporateSetup(page);
  await page.goto('/#/dashboard/campaigns');
  await expect(page.getByTestId('create-form')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('create-type')).toHaveCount(0);
  await page.getByTestId('create-name').fill('Holiday Cards');
  await page.getByTestId('create-submit').click();
  await expect(page.getByTestId('create-dialog')).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: `${OUT}/${LABEL}-corporate-create-dialog-desktop.png`, fullPage: true });
  await page.getByTestId('create-type').fill('Holiday');
  await page.getByTestId('create-confirm').dblclick();
  await expect(page.getByTestId('create-dialog')).toHaveCount(0);
  expect(writes).toEqual(['POST create {"name":"Holiday Cards","campaignType":"Holiday"}']);
});

test('proposed W32: failure keeps dialog, name and type', async ({ page }) => {
  test.skip(LABEL !== 'proposed');
  await corporateSetup(page, { createStatus: 400, createBody: { ok: false, error: 'A campaign named that already exists.' } });
  await page.goto('/#/dashboard/campaigns');
  await page.getByTestId('create-name').fill('Dup');
  await page.getByTestId('create-submit').click();
  await page.getByTestId('create-type').fill('Holiday');
  await page.getByTestId('create-confirm').click();
  await expect(page.getByTestId('create-error')).toBeVisible();
  await expect(page.getByTestId('create-type')).toHaveValue('Holiday');
  await page.screenshot({ path: `${OUT}/${LABEL}-corporate-create-error-desktop.png`, fullPage: true });
  await page.getByTestId('create-cancel').click();
  await expect(page.getByTestId('create-name')).toHaveValue('Dup');
});

// ---- founder fundraising (W34 / W35) -----------------------------------------------------------
const FR_ORG = { organizationId: 'org_ce665b98', legalName: 'NJ Mediation Service', orgType: 'nonprofit', status: 'approved', adminUserIds: [] };
const FR_CAMPAIGNS = [{ campaignId: 'cmp_1', organizationId: FR_ORG.organizationId, title: 'Spring Drive', status: 'draft' }];
const OVERVIEW = { organizations: { total: 1, byStatus: { approved: 1 } }, campaigns: { total: 1, byStatus: { draft: 1 } }, participants: { total: 12, active: 11 }, economics: { activeVersions: 0 } };
async function fundraisingSetup(page, history = []) {
  await setup(page, FOUNDER);
  const f = `${API}/api/fundraiser/admin`;
  await json(page, `${f}/overview`, OVERVIEW);
  await json(page, `${f}/organizations`, [FR_ORG]);
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/campaigns`, FR_CAMPAIGNS);
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/totals/participants`, { participants: 12, attributionRecords: 3 });
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/totals/ledger`, { conversions: 0, renewals: 0, refunds: 0 });
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/reconciliation`, { reconciled: true });
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/payouts/status`, { disabled: true }, 503);
  await json(page, `${f}/organizations/${FR_ORG.organizationId}/audit`, []);
  await json(page, `${f}/campaigns/cmp_1/economics/history`, history);
}

for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  test(`render founder fundraising draft economics ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await fundraisingSetup(page);
    await page.goto('/#/dashboard/fundraiser/admin');
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await page.screenshot({ path: `${OUT}/${LABEL}-fundraising-closed-${name}.png`, fullPage: true });
    if (LABEL === 'proposed') {
      await expect(page.getByTestId('f1-form')).toHaveCount(0);
      await page.getByTestId('f1-toggle').click();
      await page.getByTestId('f1-campaign').selectOption('cmp_1');
      await page.getByTestId('f1-initial-type').selectOption('percent_of_base');
      await page.getByTestId('f1-initial-basis').selectOption('ENSR');
      await page.getByTestId('f1-initial-percent').fill('40');
      await page.getByTestId('f1-economics').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${LABEL}-fundraising-open-${name}.png`, fullPage: true });
      await expect(page.getByTestId('f1-preview-initial')).toHaveText('40% of Eligible Net Subscription Revenue (ENSR)');
      if (vp.width < 600) expect(await overflowX(page)).toBeLessThanOrEqual(0); else test.info().annotations.push({ type: 'desktop-overflow-px', description: String(await overflowX(page)) });
      await page.getByTestId('f1-close').click();
      await expect(page.getByTestId('f1-toggle')).toBeFocused();
      await expect(page.getByTestId('f1-form')).toHaveCount(0);
      await page.getByTestId('f1-toggle').click();
      await expect(page.getByTestId('f1-initial-type')).toHaveValue('');
    } else {
      await page.getByRole('heading', { name: 'Draft economics' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${LABEL}-fundraising-open-${name}.png`, fullPage: true });
    }
    expect(writes).toEqual([]);
  });
}

// ---- founder central command (W36) -------------------------------------------------------------
async function commandSetup(page) {
  await setup(page, FOUNDER);
  await json(page, `${API}/api/founder/command/qr-cash-payouts/summary`, { ok: true, unresolvedCount: 0, unresolvedTotalCents: 0, oldestUnresolvedAgeMs: null, flaggedCount: 0 });
  await json(page, `${API}/api/fundraiser/admin/overview`, { ...OVERVIEW, organizations: { total: 3, byStatus: { approved: 2, suspended: 1 } }, campaigns: { total: 5, byStatus: { active: 2, draft: 3 } }, economics: { activeVersions: 2 } });
  await json(page, `${API}/api/fundraiser/admin/organizations`, [FR_ORG, { organizationId: 'org_b', legalName: 'Beta Club' }]);
  await json(page, `${API}/api/sales/admin/salespeople`, { ok: true, salespeople: [{ salespersonId: 'sp1', status: 'active' }] });
  await json(page, `${API}/api/founder/catalog/providers`, { ok: true, providers: [{ providerId: 'goody', enabled: true }] });
}
for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  test(`render founder central command ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await commandSetup(page);
    await page.goto('/#/dashboard/founder/command');
    await expect(page.getByTestId('founder-central-command')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${OUT}/${LABEL}-command-${name}.png`, fullPage: true });
    if (LABEL === 'proposed') {
      for (const id of ['campaigns', 'participants', 'partner', 'activation']) await expect(page.getByTestId(`fcc-card-${id}`)).toBeVisible();
      await expect(page.getByTestId('fcc-partner-org-org_b')).toHaveAttribute('href', '#/dashboard/fundraiser/partner/org_b');
      if (vp.width < 600) expect(await overflowX(page)).toBeLessThanOrEqual(0); else test.info().annotations.push({ type: 'desktop-overflow-px', description: String(await overflowX(page)) });
    }
    expect(writes).toEqual([]);
  });
}

// ---- salesperson control center (W37 / W38) ----------------------------------------------------
const HEALTH = {
  salespersonId: 'sp1',
  totals: { no_referral: 0, referral_validated: 12, attributed: 3, gift_claim_validated: 0, carrier_unavailable: 0, window_expired: 2, unresolvable: 1, attribution_disabled: 0 },
  byDay: { '2026-09-28': { referral_validated: 7, attributed: 2, window_expired: 2 }, '2026-09-29': { referral_validated: 5, attributed: 1 }, '2026-09-30': { referral_validated: 1 } },
  validatedCount: 12, attributedCount: 3, carrierUnavailableCount: 7, expiredCount: 2, lossRateBps: 8333, consideredCount: 12,
};
async function salesSetup(page, { health = HEALTH, controls = { path: 'salesperson_attribution', referralPublicLive: true, attributionLive: false }, linkStatus = 'active' } = {}) {
  await setup(page, FOUNDER);
  const s = `${API}/api/sales/admin`;
  await json(page, `${s}/salespeople`, { ok: true, salespeople: [{ salespersonId: 'sp1', displayName: 'Rudy Fixture', status: linkStatus }] });
  await json(page, `${s}/salespeople/sp1`, { ok: true, salesperson: { salespersonId: 'sp1', displayName: 'Rudy Fixture', status: linkStatus, email: 'rudy@example.com', referralSlug: 'rudy' } });
  await json(page, `${s}/salespeople/sp1/summary`, { ok: true, summary: { linkStatus, originatedDirectCustomers: 4, originatedFundraiserPartners: 1, originalPaidConversions: 3, recurringPaidTransactions: 9, entryCount: 12, eligibleRevenueMinor: 123456, pendingCommissionMinor: 2500, approvedCommissionMinor: 1000, paidCommissionMinor: 0, reversedCommissionMinor: 0 } });
  await json(page, `${s}/salespeople/sp1/attribution-health`, { ok: true, attributionHealth: health, controls });
  await json(page, `${s}/salespeople/sp1/ledger`, { ok: true, entries: [] });
  await json(page, `${s}/controls`, { ok: true, controls });
}
for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  test(`render salesperson attribution health ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await salesSetup(page);
    await page.goto('/#/dashboard/founder/salespeople');
    await page.getByTestId('fcc-row-sp1').click();
    await expect(page.getByTestId('fcc-report')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('fcc-report').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${LABEL}-sales-health-${name}.png`, fullPage: true });
    const body = await page.locator('body').innerText();
    if (LABEL === 'proposed') {
      expect(body).not.toContain('[object Object]');
      await expect(page.getByTestId('fcc-health-totals')).toBeVisible();
      await expect(page.getByTestId('fcc-health-day-2026-09-29')).toBeVisible();
      await expect(page.getByTestId('fcc-effective-status')).toContainText('Active, referral surface paused');
      if (vp.width < 600) expect(await overflowX(page)).toBeLessThanOrEqual(0); else test.info().annotations.push({ type: 'desktop-overflow-px', description: String(await overflowX(page)) });
    } else {
      expect(body).toContain('[object Object]'); // documents the current defect
    }
    expect(writes).toEqual([]);
  });
}
test('proposed W37: empty and malformed fixtures never print [object Object]', async ({ page }) => {
  test.skip(LABEL !== 'proposed');
  for (const health of [{ totals: {}, byDay: {}, lossRateBps: null }, { totals: 'x', byDay: [1], odd: { a: 1 } }]) {
    await salesSetup(page, { health });
    await page.goto('/#/dashboard/founder/salespeople');
    await page.getByTestId('fcc-row-sp1').click();
    await expect(page.getByTestId('fcc-health')).toBeVisible({ timeout: 20000 });
    expect(await page.locator('body').innerText()).not.toContain('[object Object]');
  }
});
test('proposed W38: effective status for an inactive salesperson, no mutation', async ({ page }) => {
  test.skip(LABEL !== 'proposed');
  await salesSetup(page, { linkStatus: 'inactive' });
  await page.goto('/#/dashboard/founder/salespeople');
  await page.getByTestId('fcc-row-sp1').click();
  await expect(page.getByTestId('fcc-effective-status')).toContainText('Inactive');
  expect(writes).toEqual([]);
});

// ---- HELD items W24-W28 / W30: CURRENT-STATE captures only (nothing implemented) ----------------
test('capture held-item current state (W24/W25/W26/W27/W28/W30)', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await corporateSetup(page);
  await page.goto('/#/dashboard/campaigns');
  await expect(page.getByTestId('contact-tiles-panel')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-testid$="-manage"]').first().click();
  await page.getByTestId('contact-tiles-panel').screenshot({ path: `${OUT}/held-w24-tiles-manage-open.png` });
  await page.getByTestId('card-open-c1').click();
  await page.getByTestId('card-tab-recipients-c1').click();
  await page.screenshot({ path: `${OUT}/held-w25-recipients-tab.png` });
  await page.getByTestId('card-individual-c1').click();
  await page.screenshot({ path: `${OUT}/held-w26-picker-open.png` });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${OUT}/held-w26-after-escape.png` });
  // Escape with the picker open may close the WHOLE campaign dialog (evidence for W26); reopen if so.
  if (!(await page.getByTestId('card-tab-gift-c1').isVisible())) await page.getByTestId('card-open-c1').click();
  await page.getByTestId('card-tab-gift-c1').click();
  await page.screenshot({ path: `${OUT}/held-w28-w30-gift-tab.png`, fullPage: true });
  expect(writes).toEqual([]);
});