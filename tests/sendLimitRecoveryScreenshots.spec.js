// tests/sendLimitRecoveryScreenshots.spec.js
//
// SEND-LIMIT RECOVERY CORRECTION (2026-09-30) — the 12 required desktop visual-evidence
// screenshots. Fully isolated: every /api/** call is intercepted by Playwright and answered from
// an in-memory fixture — nothing ever reaches a real backend, still less production. Auth is
// seeded directly into localStorage (the same token+user shape AuthContext itself reads), and the
// marketplace cart is seeded directly into localStorage (the same key cartService itself reads),
// so no real login and no real Gift Place browsing is needed to reach the states under test.
//
// Run: npx playwright test tests/sendLimitRecoveryScreenshots.spec.js --project=Desktop

import { test, expect } from '@playwright/test';

const FIXTURE_USER = {
  id: 'fixture-user-1',
  name: 'Alex Fixture',
  email: 'alex.fixture@example.com',
  photoUrl: 'https://example.com/fixture-photo.jpg',
  emailVerified: true,
  plan: 'free',
  tier: 'free',
  // Established-user signal — keeps the first-time GuidedSetupFlow onboarding overlay from
  // covering the page; these screenshots are about the send-limit recovery flow, not onboarding.
  personalizationComplete: true,
};

const FIXTURE_CONTACT = { id: 'contact-1', name: 'Jamie Recipient', email: 'jamie@example.com' };

const FIXTURE_CART_ITEM = {
  id: 'cart-item-1',
  sendContext: 'greeting-flow',
  name: 'Handcrafted Mug',
  price: 24.99,
  printfulSyncVariantId: 5298250656,
  image: null,
};

const INSUFFICIENT_PREFLIGHT = {
  canSendGreeting: false,
  reasonCode: 'GENERATION_CAP',
  tier: 'free',
  sendsRemaining: 0,
  sendsUsed: 3,
  sendsLimit: 3,
};

const SUFFICIENT_PREFLIGHT = {
  canSendGreeting: true,
  reasonCode: null,
  tier: 'free',
  sendsRemaining: 2,
  sendsUsed: 1,
  sendsLimit: 3,
};

async function seedAuthAndCart(page, { cart = true, user = FIXTURE_USER } = {}) {
  await page.addInitScript(([u, contact, cartItem, withCart]) => {
    localStorage.setItem('token', 'fixture-token');
    localStorage.setItem('user', JSON.stringify(u));
    if (withCart) {
      localStorage.setItem('greetme_cart', JSON.stringify([cartItem]));
    }
  }, [user, FIXTURE_CONTACT, FIXTURE_CART_ITEM, cart]);
}

async function mockApi(page, { preflight = INSUFFICIENT_PREFLIGHT, user = FIXTURE_USER } = {}) {
  // Playwright uses the LAST-registered matching route, so the safe catch-all is registered
  // FIRST — every specific handler registered after it takes priority for its own exact path.
  // (occasions, referral, job-status polling, etc. all fall through to this — never a real
  // network hop.)
  await page.route('http://127.0.0.1:8099/api/**', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('http://127.0.0.1:8099/api/entitlements/send-preflight', (route) =>
    route.fulfill({ json: preflight })
  );
  await page.route('http://127.0.0.1:8099/api/entitlements/gift-only-authorization', (route) =>
    route.fulfill({ json: { ok: true, token: 'fixture-gift-only-token' } })
  );
  await page.route('http://127.0.0.1:8099/api/contacts', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: { contacts: [FIXTURE_CONTACT] } });
  });
  await page.route('http://127.0.0.1:8099/api/profile', (route) =>
    route.fulfill({ json: { profile: { ...user } } })
  );
  await page.route('http://127.0.0.1:8099/api/hearts/balance', (route) => route.fulfill({ json: { balance: 0 } }));
  await page.route('http://127.0.0.1:8099/api/wallet', (route) =>
    route.fulfill({ json: { ok: true, wallet: {
      unmetered: false, totalSpendableNow: 0,
      monthly: { remaining: 0, cap: 3 }, anytime: { available: 0, includedCap: 0 },
      banked: { available: 0, cap: 0 }, purchased: { animationCredits: 0, spendable: true },
    } } })
  );
}

async function goToSend(page, query = '') {
  // HashRouter app — every real route lives under '/#/...'.
  await page.goto(`/#/dashboard/send${query}`);
  await expect(page.getByText('Send a Greet-Me™')).toBeVisible({ timeout: 15000 });
}

async function selectContact(page) {
  await page.locator('select[name="contactId"]').selectOption(FIXTURE_CONTACT.id);
}

async function selectMarketplaceGift(page) {
  await page.getByRole('button', { name: /Add a Gift \(Optional\)|Edit Gift/ }).click();
  await page.locator('input[type="radio"][value="marketplace"]').first().check();
  await page.getByRole('button', { name: 'Cancel' }).click();
}

test.describe('Send-limit recovery — desktop visual evidence', () => {
  test('01 - insufficient-send caution shown with a gift selected', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Your gift may arrive without its Greet-Me')).toBeVisible();
    await page.screenshot({ path: 'test-results/send-limit-recovery/01-insufficient-send-caution.png' });
  });

  test('02 - Top Up choice highlighted', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-topup').hover();
    await page.screenshot({ path: 'test-results/send-limit-recovery/02-topup-choice.png' });
  });

  test('03 - Upgrade choice highlighted', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-upgrade').hover();
    await page.screenshot({ path: 'test-results/send-limit-recovery/03-upgrade-choice.png' });
  });

  test('04 - cancel and return preserves the composed draft and selected gift', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-cancel').click();
    await expect(page.getByTestId('caution-triangle')).toHaveCount(0);
    // The draft (contact) and the selected gift chip are both still present — nothing was lost.
    await expect(page.locator('select[name="contactId"]')).toHaveValue(FIXTURE_CONTACT.id);
    await expect(page.getByText('Edit Gift', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/send-limit-recovery/04-cancel-and-return.png' });
  });

  test('09 - explicit continue-without-Greet-Me confirmation', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-gift-only').click();
    await expect(page.getByTestId('gift-only-second-confirmation')).toBeVisible();
    await page.screenshot({ path: 'test-results/send-limit-recovery/09-continue-without-greetme-confirmation.png' });
  });

  test('10 - post-decision notice after confirming gift-only', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-gift-only').click();
    await expect(page.getByTestId('gift-only-second-confirmation')).toBeVisible();
    await page.getByTestId('gift-only-second-confirmation').getByRole('button', { name: /confirm|yes/i }).click();
    await expect(page.getByTestId('caution-triangle')).toHaveCount(0, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/10-post-decision-notice.png' });
  });

  test('12 - sufficient entitlement: no unnecessary warning appears', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: SUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    // The checkout proceeds straight through — the caution modal must never mount.
    await page.waitForURL(/\/dashboard\/checkout/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('caution-triangle')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/send-limit-recovery/12-sufficient-entitlement-no-warning.png' });
  });

  test('05 - successful purchase return (marker consumed, resume dispatched)', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    await mockApi(page, { preflight: SUFFICIENT_PREFLIGHT });
    await page.route('http://127.0.0.1:8099/api/jobs/send-greeting', (route) =>
      route.fulfill({ json: { jobId: 'fixture-job-1' } })
    );
    await page.route('http://127.0.0.1:8099/api/jobs/fixture-job-1', (route) =>
      route.fulfill({ json: { status: 'completed' } })
    );
    // Simulate the state saveDraftForPricingReturn would have left behind just before the sender
    // was routed to Stripe for a Top Up/Upgrade purchase reached from the recovery-after-separation
    // panel (an already-confirmed, already-charged gift waiting only on a send).
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: 'So proud of you!' },
        giftSettings: { type: 'marketplace' },
        confirmedGiftPayload: { giftType: 'marketplace', claimToken: 'fixture-claim-token' },
        giftSeparatedByEntitlement: true,
      }));
      sessionStorage.setItem('greetme_post_checkout_return', 'send');
    }, [FIXTURE_CONTACT]);
    await page.goto('/#/payment/success?session_id=cs_test_fixture');
    // The marker routes straight back into the send page, which — because a confirmedGiftPayload
    // was preserved — auto-retries the paused send without any further click.
    await expect(page.getByText(/Preparing your moment/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/#\/dashboard\/send/);
    await page.screenshot({ path: 'test-results/send-limit-recovery/05-successful-purchase-return.png' });
  });

  test('06-07 - authoritative entitlement refresh and restored greeting/gift selection', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    await mockApi(page, { preflight: SUFFICIENT_PREFLIGHT });
    // An ORDINARY Top Up/Upgrade return (no gift charged yet) — no confirmedGiftPayload, so no
    // auto-retry fires; this shows the plain restored draft + gift selection, now that entitlement
    // has been refreshed to sufficient.
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: 'So proud of you!' },
        giftSettings: { type: 'marketplace' },
      }));
    }, [FIXTURE_CONTACT]);
    await goToSend(page, '?returnTo=send');
    await expect(page.locator('select[name="contactId"]')).toHaveValue(FIXTURE_CONTACT.id, { timeout: 10000 });
    await expect(page.getByText('Edit Gift', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/send-limit-recovery/06-07-entitlement-refresh-and-restored-draft.png' });
  });

  test('11 - failed/cancelled checkout recovery panel', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    // Preflight still insufficient — simulating a Top Up that failed or was cancelled — so the
    // auto-retry's send attempt fails again with the backend's own pre-existing cap code, and the
    // recovery panel re-appears rather than silently losing the already-charged gift.
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await page.route('http://127.0.0.1:8099/api/jobs/send-greeting', (route) =>
      route.fulfill({ status: 403, json: { error: 'Generation cap reached', code: 'GENERATION_CAP' } })
    );
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: '' },
        giftSettings: { type: 'marketplace' },
        confirmedGiftPayload: { giftType: 'marketplace', claimToken: 'fixture-claim-token' },
        giftSeparatedByEntitlement: true,
      }));
    }, [FIXTURE_CONTACT]);
    await goToSend(page, '?returnTo=send');
    await expect(page.getByTestId('gift-separated-recovery')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/11-failed-checkout-recovery.png' });
  });

  test('08 - successful paired-send readiness', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    await mockApi(page, { preflight: SUFFICIENT_PREFLIGHT });
    await page.route('http://127.0.0.1:8099/api/jobs/send-greeting', (route) =>
      route.fulfill({ json: { jobId: 'fixture-job-1' } })
    );
    await page.route('http://127.0.0.1:8099/api/jobs/fixture-job-1', (route) =>
      route.fulfill({ json: { status: 'completed' } })
    );
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: 'So proud of you!' },
        giftSettings: { type: 'marketplace' },
        confirmedGiftPayload: { giftType: 'marketplace', claimToken: 'fixture-claim-token' },
        giftSeparatedByEntitlement: true,
      }));
    }, [FIXTURE_CONTACT]);
    // A plain goto here, not goToSend — the auto-retry can complete fast enough after restore
    // that the ordinary "Send a Greet-Me™" heading is never the stable state to wait on.
    await page.goto('/#/dashboard/send?returnTo=send');
    // The preserved gift + a now-sufficient entitlement let the auto-retried send proceed and
    // complete — the paired Greet-Me and gift are both, finally, going out together.
    await expect(page.getByText(/Preparing your moment/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/08-paired-send-readiness.png' });
  });
});

// ===========================================================================
// FINAL NARROW CORRECTION (2026-09-30) — founder-confirmed: "Purchase Additional Sends" routes
// unconditionally to the existing Animation Bank (no tier gating). Also captures the fixed Upgrade
// destination (was a never-existent nested route before this correction).
// ===========================================================================
test.describe('Top-Up reconciliation — desktop visual evidence', () => {
  test('13 - Purchase Additional Sends reaches the real Animation Bank page with the existing packs modal auto-opened', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-topup').click();
    await expect(page).toHaveURL(/#\/dashboard\/animations\?openPacks=true/, { timeout: 10000 });
    // The EXISTING packs modal (selection step) opened automatically — no click needed to find it.
    await expect(page.getByText(/Starter|Celebration|Holiday/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/13-purchase-additional-sends-destination.png' });
  });

  test('14 - Upgrade Plan reaches the real Pricing page (fixed: was a never-existent nested route before this correction)', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('caution-upgrade').click();
    await expect(page).toHaveURL(/#\/pricing\?view=personal&returnTo=send/, { timeout: 10000 });
    await expect(page.getByTestId('pricing-return-to-send-banner')).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/send-limit-recovery/14-upgrade-pricing-destination.png' });
  });

  test('15 - successful Purchase Additional Sends return: draft preserved, entitlement refreshed, paired-send readiness', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    await mockApi(page, { preflight: SUFFICIENT_PREFLIGHT });
    await page.route('http://127.0.0.1:8099/api/jobs/send-greeting', (route) =>
      route.fulfill({ json: { jobId: 'fixture-job-topup-1' } })
    );
    await page.route('http://127.0.0.1:8099/api/jobs/fixture-job-topup-1', (route) =>
      route.fulfill({ json: { status: 'completed' } })
    );
    // Simulates the state saveDraftForAnimationBankReturn leaves behind just before the sender was
    // routed to the real Animation Pack purchase flow from the recovery-after-separation panel.
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: 'So proud of you!' },
        giftSettings: { type: 'marketplace' },
        confirmedGiftPayload: { giftType: 'marketplace', claimToken: 'fixture-claim-token' },
        giftSeparatedByEntitlement: true,
      }));
      sessionStorage.setItem('greetme_post_checkout_return', 'send');
    }, [FIXTURE_CONTACT]);
    // The SAME purchase-type-agnostic marker PaymentSuccess.jsx already reads for the Pricing/
    // Upgrade path — proving the Purchase-Additional-Sends destination reconnects through the
    // identical mechanism. Never infers success from the visit alone: this is the SAME
    // authoritative-entitlement-then-resume path, not a shortcut for this specific destination.
    await page.goto('/#/payment/success?session_id=cs_test_fixture_topup');
    await expect(page.getByText(/Preparing your moment/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/15-successful-purchase-return-and-resume.png' });
  });

  test('16 - failed/cancelled Purchase Additional Sends: recovery panel re-appears, gift preserved, nothing granted', async ({ page }) => {
    await seedAuthAndCart(page, { cart: false });
    // Preflight still insufficient — simulating an Animation Pack purchase that failed or was
    // cancelled — so the auto-retry's send attempt fails again and the recovery panel returns.
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await page.route('http://127.0.0.1:8099/api/jobs/send-greeting', (route) =>
      route.fulfill({ status: 403, json: { error: 'Generation cap reached', code: 'GENERATION_CAP' } })
    );
    await page.addInitScript(([contact]) => {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        formData: { contactId: contact.id, occasionType: 'Thinking of You', customMessage: '' },
        giftSettings: { type: 'marketplace' },
        confirmedGiftPayload: { giftType: 'marketplace', claimToken: 'fixture-claim-token' },
        giftSeparatedByEntitlement: true,
      }));
    }, [FIXTURE_CONTACT]);
    await goToSend(page, '?returnTo=send');
    await expect(page.getByTestId('gift-separated-recovery')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/send-limit-recovery/16-failed-purchase-recovery.png' });
  });
});

// ===========================================================================
// FOUNDER-APPROVED LABEL CORRECTION (2026-09-30) — "Top Up" -> "Purchase Additional Sends",
// "Upgrade" -> "Upgrade Plan" in the shared GiftEntitlementCautionModal. Copy only: same handlers,
// same testids, same destinations, same layout.
// ===========================================================================
test.describe('Label correction — desktop visual evidence', () => {
  test('label-correction-01 - caution modal shows both new labels, full page context', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('caution-topup')).toHaveText(/Purchase Additional Sends/);
    await expect(page.getByTestId('caution-upgrade')).toHaveText(/Upgrade Plan/);
    await page.screenshot({ path: 'test-results/send-limit-recovery/label-correction-01-caution-modal-new-labels.png' });
  });

  test('label-correction-02 - caution modal close-up, both new labels legible', async ({ page }) => {
    await seedAuthAndCart(page);
    await mockApi(page, { preflight: INSUFFICIENT_PREFLIGHT });
    await goToSend(page);
    await selectContact(page);
    await selectMarketplaceGift(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('gift-entitlement-caution').screenshot({
      path: 'test-results/send-limit-recovery/label-correction-02-caution-modal-closeup.png',
    });
  });
});
