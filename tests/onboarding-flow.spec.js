/**
 * onboarding-flow.spec.js
 * End-to-end onboarding flow + 11 test greetings with varied inputs
 *
 * Tests:
 * 1. Registration + onboarding modal appears
 * 2. Step order: Welcome → ProcessOrientation → DemoGreeting → Voice → Photo → TestGreeting → Sending → Success
 * 3. CTA routing from Success step
 * 4-14. 11 test greetings via API with varied occasions, tones, relationships
 */

import { test, expect } from '@playwright/test';
import { requireSafeApiBase } from '../safety/apiTarget.mjs';

// Team F fail-closed guard. Runs at module evaluation (before any beforeAll), so
// a rejection throws BEFORE any registration/send-greeting network call. This
// spec registers users and sends greetings, so it requires the explicit
// ALLOW_ISOLATED_TEST=1 opt-in AND a local/allow-listed API_BASE. It can never
// default to — or be coerced into contacting — production.
const API_BASE = requireSafeApiBase({
  requireIsolatedOptIn: true,
  context: 'onboarding-flow.spec.js',
});
const APP_BASE = process.env.BASE_URL || 'http://localhost:5173';

// Helper: register a fresh user via API
async function registerUser(request, suffix) {
  const email = `playwright-${suffix}-${Date.now()}@greetme.test`;
  const password = 'PlayTest123!';

  const res = await request.post(`${API_BASE}/api/auth/register`, {
    data: { email, password, name: `Test ${suffix}` },
  });
  const body = await res.json();
  return { email, password, token: body.token, userId: body.userId };
}

// Helper: login and get token
async function loginUser(request, email, password) {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();
  return body.token;
}

// Helper: send a greeting via API
async function sendGreeting(request, token, payload) {
  const res = await request.post(`${API_BASE}/api/jobs/send-greeting`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  return { status: res.status(), body: await res.json() };
}

// ============================================================
// TEST GROUP 1: Onboarding UI Flow (Desktop)
// ============================================================
test.describe('Onboarding Flow UI', () => {
  let userCreds;

  test.beforeAll(async ({ request }) => {
    userCreds = await registerUser(request, 'onboard');
  });

  test('1. Onboarding modal appears after registration and shows Welcome step', async ({ page }) => {
    // Login via UI
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type="email"]', userCreds.email);
    await page.fill('input[type="password"]', userCreds.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard + onboarding modal
    await page.waitForSelector('text=Welcome to Greet-Me', { timeout: 15000 });
    const modal = page.locator('text=Welcome to Greet-Me');
    await expect(modal).toBeVisible();
  });

  test('2. Welcome → ProcessOrientation step transition', async ({ page }) => {
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type="email"]', userCreds.email);
    await page.fill('input[type="password"]', userCreds.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Welcome to Greet-Me', { timeout: 15000 });

    // Click through Welcome
    await page.click('text=Get Started');
    // Should see ProcessOrientation content
    await expect(page.locator('text=Let\'s set this up')).toBeVisible({ timeout: 5000 });
  });

  test('3. ProcessOrientation → DemoGreeting step transition', async ({ page }) => {
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type="email"]', userCreds.email);
    await page.fill('input[type="password"]', userCreds.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Welcome to Greet-Me', { timeout: 15000 });

    // Welcome → ProcessOrientation
    await page.click('text=Get Started');
    await page.waitForSelector('text=Let\'s set this up', { timeout: 5000 });

    // ProcessOrientation → DemoGreeting
    await page.click('text=Let\'s set this up');
    await expect(page.locator('text=See How a Greet-Me Feels')).toBeVisible({ timeout: 5000 });
  });

  test('4. DemoGreeting shows all 4 demo stages and Continue button', async ({ page }) => {
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type="email"]', userCreds.email);
    await page.fill('input[type="password"]', userCreds.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Welcome to Greet-Me', { timeout: 15000 });

    // Navigate to DemoGreeting
    await page.click('text=Get Started');
    await page.waitForSelector('text=Let\'s set this up', { timeout: 5000 });
    await page.click('text=Let\'s set this up');
    await page.waitForSelector('text=See How a Greet-Me Feels', { timeout: 5000 });

    // Verify 4 demo stages
    await expect(page.locator('text=Envelope arrives')).toBeVisible();
    await expect(page.locator('text=Card opens')).toBeVisible();
    await expect(page.locator('text=Hey — I just wanted to stop and say welcome to the neighborhood.')).toBeVisible();
    await expect(page.locator('text=Your voice greeting plays here')).toBeVisible();
    await expect(page.locator('text=Continue Onboarding')).toBeVisible();
  });

  test('5. DemoGreeting → Voice step transition', async ({ page }) => {
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type="email"]', userCreds.email);
    await page.fill('input[type="password"]', userCreds.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Welcome to Greet-Me', { timeout: 15000 });

    await page.click('text=Get Started');
    await page.waitForSelector('text=Let\'s set this up', { timeout: 5000 });
    await page.click('text=Let\'s set this up');
    await page.waitForSelector('text=Continue Onboarding', { timeout: 5000 });
    await page.click('text=Continue Onboarding');

    // Should see Voice step
    await expect(page.locator('text=Record your voice so your greetings sound like you.')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=A short message is perfect.')).toBeVisible();
  });
});

// ============================================================
// TEST GROUP 2: 11 Test Greetings via API
// ============================================================
test.describe('11 Test Greetings - Varied Inputs', () => {
  let token;

  test.beforeAll(async ({ request }) => {
    const user = await registerUser(request, 'greetings');
    token = user.token;
  });

  const TEST_CASES = [
    {
      name: '6. Birthday + warm + friend',
      payload: {
        recipientName: 'Sarah',
        recipientEmail: 'test-sarah@greetme.test',
        occasionKey: 'birthday',
        tone: 'warm',
        relationshipKey: 'friend',
        personalSentiment: 'Hope your birthday is everything you deserve!',
      },
    },
    {
      name: '7. Thank you + heartfelt + parent',
      payload: {
        recipientName: 'Mom',
        recipientEmail: 'test-mom@greetme.test',
        occasionKey: 'thank_you',
        tone: 'heartfelt',
        relationshipKey: 'parent',
        personalSentiment: 'Thank you for always being there for me.',
      },
    },
    {
      name: '8. Anniversary + romantic + spouse',
      payload: {
        recipientName: 'Jessica',
        recipientEmail: 'test-jessica@greetme.test',
        occasionKey: 'anniversary',
        tone: 'romantic',
        relationshipKey: 'spouse',
        personalSentiment: 'Another year together and I love you more than ever.',
      },
    },
    {
      name: '9. Congratulations + playful + coworker',
      payload: {
        recipientName: 'Marcus',
        recipientEmail: 'test-marcus@greetme.test',
        occasionKey: 'congratulations',
        tone: 'playful',
        relationshipKey: 'coworker',
        personalSentiment: 'You absolutely crushed that presentation!',
      },
    },
    {
      name: '10. Get well + gentle + grandparent',
      payload: {
        recipientName: 'Grandpa Joe',
        recipientEmail: 'test-grandpa@greetme.test',
        occasionKey: 'get_well',
        tone: 'gentle',
        relationshipKey: 'grandparent',
        personalSentiment: 'Thinking of you and sending healing vibes.',
      },
    },
    {
      name: '11. Just because + warm + sibling',
      payload: {
        recipientName: 'Alex',
        recipientEmail: 'test-alex@greetme.test',
        occasionKey: 'just_because',
        tone: 'warm',
        relationshipKey: 'sibling',
        personalSentiment: 'Just wanted you to know I appreciate you.',
      },
    },
    {
      name: '12. Birthday + playful + child + with onboarding photos',
      payload: {
        recipientName: 'Little Emma',
        recipientEmail: 'test-emma@greetme.test',
        occasionKey: 'birthday',
        tone: 'playful',
        relationshipKey: 'child',
        personalSentiment: 'Happy birthday my little sunshine!',
        photos: [
          'onboarding/photo-1-friends-sunset.jpeg',
          'onboarding/photo-2-friends-dinner.jpeg',
          'onboarding/photo-3-confetti-party.jpeg',
          'onboarding/photo-4-time-to-celebrate.jpeg',
        ],
      },
    },
    {
      name: '13. Thank you + formal + mentor',
      payload: {
        recipientName: 'Professor Chen',
        recipientEmail: 'test-chen@greetme.test',
        occasionKey: 'thank_you',
        tone: 'formal',
        relationshipKey: 'mentor',
        personalSentiment: 'Your guidance has shaped my career in ways I cannot fully express.',
      },
    },
    {
      name: '14. Anniversary + heartfelt + fiancé',
      payload: {
        recipientName: 'Daniel',
        recipientEmail: 'test-daniel@greetme.test',
        occasionKey: 'anniversary',
        tone: 'heartfelt',
        relationshipKey: 'fiance',
        personalSentiment: 'Can\'t wait to spend forever with you.',
      },
    },
    {
      name: '15. Congratulations + warm + close_friend + with gift',
      payload: {
        recipientName: 'Priya',
        recipientEmail: 'test-priya@greetme.test',
        occasionKey: 'congratulations',
        tone: 'warm',
        relationshipKey: 'close_friend',
        personalSentiment: 'So proud of your new promotion!',
        includeGift: true,
      },
    },
    {
      name: '16. Just because + playful + partner + with photos + gift',
      payload: {
        recipientName: 'Taylor',
        recipientEmail: 'test-taylor@greetme.test',
        occasionKey: 'just_because',
        tone: 'playful',
        relationshipKey: 'partner',
        personalSentiment: 'No reason needed to tell you you\'re amazing.',
        photos: [
          'onboarding/photo-1-friends-sunset.jpeg',
          'onboarding/photo-4-time-to-celebrate.jpeg',
        ],
        includeGift: true,
      },
    },
  ];

  for (const tc of TEST_CASES) {
    test(tc.name, async ({ request }) => {
      const result = await sendGreeting(request, token, tc.payload);

      // Greeting should be created successfully
      expect(result.status).toBe(200);
      expect(result.body.ok).toBe(true);
      expect(result.body.jobId).toBeTruthy();

      console.log(`  ✅ ${tc.name} → jobId: ${result.body.jobId}`);
    });
  }
});
