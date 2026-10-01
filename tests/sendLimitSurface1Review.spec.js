import { test, expect } from '@playwright/test';

const FIXTURE_USER = {
  id: 'surface-1-user',
  name: 'Alex Fixture',
  email: 'alex.fixture@example.com',
  photoUrl: 'https://example.com/alex-fixture.jpg',
  emailVerified: true,
  plan: 'free',
  tier: 'free',
  personalizationComplete: true,
};

const NO_PHOTO_USER = { ...FIXTURE_USER, photoUrl: '' };
const FIXTURE_CONTACT = { id: 'surface-1-contact', name: 'Jamie Recipient', email: 'jamie@example.com' };
const FIXTURE_CART_ITEM = {
  id: 'surface-1-cart-item',
  sendContext: 'greeting-flow',
  name: 'Handcrafted Mug',
  price: 24.99,
  printfulSyncVariantId: 5298250656,
  image: null,
};
const OUTPUT = 'test-results/send-limit-review';
const SUFFICIENT_PREFLIGHT = {
  canSendGreeting: true,
  reasonCode: null,
  remaining: 2,
};
const INSUFFICIENT_PREFLIGHT = {
  canSendGreeting: false,
  reasonCode: 'GENERATION_CAP',
  tier: 'free',
  sendsRemaining: 0,
  sendsUsed: 3,
  sendsLimit: 3,
};

async function seedAndMock(page, user = FIXTURE_USER, preflight = SUFFICIENT_PREFLIGHT) {
  await page.addInitScript(([fixtureUser, cartItem]) => {
    localStorage.setItem('token', 'surface-1-fixture-token');
    localStorage.setItem('user', JSON.stringify(fixtureUser));
    localStorage.setItem('greetme_cart', JSON.stringify([cartItem]));
  }, [user, FIXTURE_CART_ITEM]);

  await page.route('http://127.0.0.1:8099/api/**', (route) =>
    route.fulfill({ json: { ok: true } })
  );
  await page.route('http://127.0.0.1:8099/api/entitlements/send-preflight', (route) =>
    route.fulfill({ json: preflight })
  );
  await page.route('http://127.0.0.1:8099/api/entitlements/gift-only-authorization', (route) =>
    route.fulfill({ json: { ok: true, token: 'surface-1-fixture-gift-only-token' } })
  );
  await page.route('http://127.0.0.1:8099/api/contacts', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: { contacts: [FIXTURE_CONTACT] } });
  });
  await page.route('http://127.0.0.1:8099/api/profile', (route) =>
    route.fulfill({ json: { profile: { ...user } } })
  );
  await page.route('http://127.0.0.1:8099/api/hearts/balance', (route) =>
    route.fulfill({ json: { balance: 0 } })
  );
  await page.route('http://127.0.0.1:8099/api/wallet', (route) =>
    route.fulfill({ json: {
      ok: true,
      wallet: {
        unmetered: false,
        totalSpendableNow: 0,
        monthly: { remaining: 0, cap: 3 },
        anytime: { available: 0, includedCap: 0 },
        banked: { available: 0, cap: 0 },
        purchased: { animationCredits: 0, spendable: true },
      },
    } })
  );
}

async function openComposer(page) {
  await page.goto('/#/dashboard/send');
  await expect(page.getByText('Send a Greet-Me™')).toBeVisible({ timeout: 15000 });
  await page.locator('select[name="contactId"]').selectOption(FIXTURE_CONTACT.id);
  await page.locator('select[name="occasionType"]').selectOption('Birthday');
  await page.locator('textarea[name="customMessage"]').fill('Wishing you a wonderful birthday, Jamie!');
}

async function chooseGift(page, type) {
  await page.getByRole('button', { name: /Add a Gift \(Optional\)|Edit Gift/ }).click();
  await page.locator(`input[type="radio"][value="${type}"]`).check();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}

test.describe('Surface 1 — isolated review renders', () => {
  test('current normal composer', async ({ page }) => {
    await seedAndMock(page);
    await openComposer(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUTPUT}/01-current-normal-composer.png` });
  });

  test('current required-photo error after attempting to send', async ({ page }) => {
    await seedAndMock(page, NO_PHOTO_USER);
    await openComposer(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await expect(page.getByText(/Please upload your photo first/i)).toBeVisible();
    await page.screenshot({ path: `${OUTPUT}/02-current-required-photo-error.png` });
  });

  test('proposed upfront required-photo disclosure, browser-only overlay', async ({ page }) => {
    await seedAndMock(page, NO_PHOTO_USER);
    await openComposer(page);
    await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h3')]
        .find((element) => element.textContent.includes('Choose Photos'));
      const section = heading?.parentElement;
      if (!section) throw new Error('Choose Photos section was not found');

      const notice = document.createElement('aside');
      notice.dataset.testid = 'proposed-required-photo-disclosure';
      notice.setAttribute('aria-label', 'Proposed required photo disclosure');
      notice.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:space-between', 'gap:16px',
        'margin:0 0 16px', 'padding:14px 16px', 'border:1px solid #d97706',
        'border-left:4px solid #d97706', 'border-radius:8px', 'background:#fffbeb',
        'color:#422006', 'font:inherit',
      ].join(';');
      notice.innerHTML = `
        <div>
          <strong style="display:block;font-size:14px;margin-bottom:4px">Profile photo required to send</strong>
          <span style="font-size:13px;line-height:1.45">Your profile photo appears as the sender. Add one in Profile before sending; occasion photos below are optional.</span>
        </div>
        <a href="/#/dashboard/profile" style="flex:none;color:#7c2d12;font-size:13px;font-weight:700;text-decoration:underline">Open Profile</a>
      `;
      section.insertBefore(notice, heading);
    });

    const heading = page.getByRole('heading', { name: 'Choose Photos' });
    await heading.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('proposed-required-photo-disclosure')).toBeVisible();
    await page.screenshot({ path: `${OUTPUT}/03-proposed-upfront-photo-disclosure.png` });
  });

  test('proposed Open Profile action reaches the existing profile route', async ({ page }) => {
    await seedAndMock(page, NO_PHOTO_USER);
    await openComposer(page);
    await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h3')]
        .find((element) => element.textContent.includes('Choose Photos'));
      const notice = document.createElement('aside');
      notice.innerHTML = '<a href="/#/dashboard/profile">Open Profile</a>';
      heading.parentElement.insertBefore(notice, heading);
    });

    await page.getByRole('link', { name: 'Open Profile' }).click();
    await expect(page).toHaveURL(/#\/dashboard\/profile$/);
  });

  test('Done & Send opens pre-send review; Edit greeting returns without dispatch', async ({ page }) => {
    let sendRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/jobs/send-greeting')) sendRequests += 1;
    });
    await seedAndMock(page);
    await openComposer(page);
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await expect(page.getByRole('heading', { name: 'Jamie Recipient', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit greeting' }).click();
    await expect(page.locator('select[name="contactId"]')).toHaveValue(FIXTURE_CONTACT.id);
    await expect(page.locator('select[name="occasionType"]')).toHaveValue('Birthday');
    await expect(page.locator('textarea[name="customMessage"]')).toHaveValue('Wishing you a wonderful birthday, Jamie!');
    expect(sendRequests).toBe(0);
  });

  test('Marketplace gift selection reaches review and Edit greeting returns without checkout', async ({ page }) => {
    let checkoutRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/payments/create-checkout')) checkoutRequests += 1;
    });
    await seedAndMock(page);
    await openComposer(page);
    await chooseGift(page, 'marketplace');
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await expect(page.getByRole('heading', { name: 'Jamie Recipient', exact: true })).toBeVisible();
    await expect(page.getByText('Handcrafted Mug', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit greeting' }).click();
    await expect(page.getByText('Gift: Greet-Me Gift Place', { exact: true })).toBeVisible();
    const cartAfterReturn = await page.evaluate(() => JSON.parse(localStorage.getItem('greetme_cart') || '[]'));
    expect(cartAfterReturn.some((item) => item.name === 'Handcrafted Mug')).toBe(true);
    expect(checkoutRequests).toBe(0);
  });

  test('Gift Only Back and Cancel return to the preserved draft without charge', async ({ page }) => {
    let checkoutRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/payments/create-checkout')) checkoutRequests += 1;
    });
    await seedAndMock(page, FIXTURE_USER, INSUFFICIENT_PREFLIGHT);
    await openComposer(page);
    await chooseGift(page, 'marketplace');
    await page.getByRole('button', { name: /Done . Send/i }).click();
    await page.getByRole('button', { name: 'Continue to Secure Checkout' }).click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible();
    await page.getByTestId('caution-gift-only').click();
    await expect(page.getByTestId('gift-only-second-confirmation')).toBeVisible();
    await page.getByTestId('gift-only-back').click();
    await expect(page.getByTestId('caution-triangle')).toBeVisible();
    await page.getByTestId('caution-cancel').click();
    await expect(page.getByTestId('caution-triangle')).toHaveCount(0);
    await expect(page.locator('select[name="contactId"]')).toHaveValue(FIXTURE_CONTACT.id);
    await expect(page.locator('select[name="occasionType"]')).toHaveValue('Birthday');
    await expect(page.getByText('Gift: Greet-Me Gift Place', { exact: true })).toBeVisible();
    const cartAfterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('greetme_cart') || '[]'));
    expect(cartAfterCancel.some((item) => item.name === 'Handcrafted Mug')).toBe(true);
    expect(checkoutRequests).toBe(0);
  });
});
