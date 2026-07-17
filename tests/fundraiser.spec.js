// tests/fundraiser.spec.js — TEAM B. Deterministic route/render proofs for the dark fundraising
// dashboards. Run against a gate-OFF build (FUNDRAISER_GATE=off) and a gate-ON build
// (FUNDRAISER_GATE=on). Auth is seeded; the fundraiser API is fully mocked (no backend, no prod).
import { test, expect } from "@playwright/test";

const GATE = process.env.FUNDRAISER_GATE || "on";
const BASE = process.env.BASE_URL || "http://localhost:5173";

const partnerOverview = { dashboard: "partner_admin", organizationId: "org_a", organizationStatus: "approved", campaigns: [{ campaignId: "cmp1", title: "Fall Drive", status: "active", programLabel: "Athletics" }], totals: { visits: 10, scans: 3, registrations: 2, conversions: 1, renewals: 0, refunds: 0, conversionRate: 0.5 }, participants: [{ attributionId: "stu_1", displayName: "Alex R.", referralCode: "ABCD1234", referralLink: "https://greet-me.com/f/ftk_x", qrPayload: "x", tokenVersion: 1, status: "active", visits: 5, scans: 2, conversions: 1 }], participantsHaveDashboard: false, financialsVisible: false };

async function seedAuth(page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "demo");
    localStorage.setItem("user", JSON.stringify({ id: "u_f", name: "F", plan: "founder", emailVerified: true }));
  });
}
function mockApi(page, counter) {
  return page.route("**/api/**", (route) => {
    const u = route.request().url();
    if (u.includes("/api/fundraiser/")) {
      counter.n++;
      if (u.match(/\/partner\/orgs\/org_b\//)) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "forbidden" }) });
      if (u.includes("/admin/overview")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dashboard: "founder_admin", organizations: { total: 0, byStatus: {} }, campaigns: { total: 0, byStatus: {} }, participants: { total: 0, active: 0 }, corrections: { pending: 0 }, economics: { activeVersions: 0 }, ledger: {}, financialsVisible: false }) });
      if (u.match(/\/partner\/orgs\/[^/]+\/overview/)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(partnerOverview) });
      if (u.includes("/earnings")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ available: false, reason: "economics_not_activated", estimateCents: null }) });
      if (u.includes("/payouts/status")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ posture: "manual_review_only", payoutsEnabled: false, held: true }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "u_f", plan: "founder" } }) });
  });
}

test.describe("dark (gate OFF)", () => {
  test.skip(GATE !== "off", "gate-off build only");

  test("no Fundraising nav link is shown", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard`);
    await page.waitForTimeout(800);
    await expect(page.locator("a", { hasText: /^Fundraising$/ })).toHaveCount(0);
  });

  test("direct Founder + Partner routes show truthful unavailable state; NO fundraiser API request", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard/fundraiser/admin`);
    await expect(page.getByText(/not currently enabled/i)).toBeVisible();
    await page.goto(`${BASE}/#/dashboard/fundraiser/partner/org_a`);
    await expect(page.getByText(/not currently enabled/i)).toBeVisible();
    expect(c.n).toBe(0); // gate off ⇒ zero fundraiser API calls
  });
});

test.describe("enabled (gate ON)", () => {
  test.skip(GATE !== "on", "gate-on build only");

  test("Founder route loads the Founder dashboard (truthful empty)", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard/fundraiser/admin`);
    await expect(page.getByRole("heading", { name: /Founder\/Admin/ })).toBeVisible();
    await expect(page.getByText(/Platform overview/)).toBeVisible();
    expect(c.n).toBeGreaterThan(0);
  });

  test("Partner route loads dashboard; HELD states shown; participants are records (no dashboard)", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard/fundraiser/partner/org_a`);
    await expect(page.getByRole("heading", { name: /Partner Administrator/ })).toBeVisible();
    await expect(page.getByText(/manual_review_only/)).toBeVisible();
    await expect(page.getByText(/economics_not_activated/)).toBeVisible();
    await expect(page.getByText(/no login or dashboard/i)).toBeVisible();
  });

  test("cross-organization access fails closed (403 ⇒ No access)", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard/fundraiser/partner/org_b`);
    await expect(page.getByText(/No access/i)).toBeVisible();
  });

  test("routes remain behind authentication (no user ⇒ redirected to /login)", async ({ page }) => {
    const c = { n: 0 }; await mockApi(page, c); // no seedAuth ⇒ unauthenticated
    await page.goto(`${BASE}/#/dashboard/fundraiser/admin`);
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/login/);
  });

  test("no participant dashboard route exists (unknown fundraiser path ⇒ fallback, not a participant view)", async ({ page }) => {
    await seedAuth(page); const c = { n: 0 }; await mockApi(page, c);
    await page.goto(`${BASE}/#/dashboard/fundraiser/participant/anything`);
    await page.waitForTimeout(600);
    await expect(page.getByText(/Participant Administrator|Founder\/Admin/)).toHaveCount(0);
  });
});
