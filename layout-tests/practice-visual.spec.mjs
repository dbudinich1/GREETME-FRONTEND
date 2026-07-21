// layout-tests/practice-visual.spec.mjs
//
// REAL-COMPONENT (Chromium) visual proof of the Recipients Practice View. The shipped
// RecipientsPracticeView.jsx is esbuild-bundled WITH react/react-dom and mounted in a real browser page
// with fictional practice contacts (reserved example domains). Not a mockup. Self-contained.
// Run: npx playwright test --config=playwright.layout.config.mjs practice-visual
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, "..", "..", "practice-shots");
mkdirSync(SHOTS, { recursive: true });

const FIXTURES = {
  family: [
    { name: "Robin Sample", email: "robin@example.com", relationship: "", recipientType: "" },
    { name: "Casey Sample", email: "casey@example.org", relationship: "", recipientType: "" },
    { name: "Dana Sample", email: "dana@example.net", relationship: "", recipientType: "" },
  ],
  friend: [
    { name: "Alex Sample", email: "alex@example.com", relationship: "", recipientType: "" },
    { name: "Sky Sample", email: "sky@example.org", relationship: "", recipientType: "" },
  ],
  professional: [
    { name: "Lee Sample", email: "lee@example.com", relationship: "colleague", relationshipCloseness: "greetme_worthy", recipientType: "" },
  ],
  employee: [
    { name: "Ada Sample", email: "ada@example.com", relationship: "employee", relationshipCategory: "professional", relationshipCloseness: "greetme_worthy", recipientType: "employee", company: "Demo Corp", department: "Engineering", birthday: "1990-05-14", shippingAddress: { line1: "1 Main St", city: "Reno", state: "NV", zip: "89501", country: "USA" } },
    { name: "Grace Sample", email: "grace@example.org", relationship: "employee", relationshipCloseness: "greetme_worthy", recipientType: "employee", company: "Demo Corp" },
  ],
  client: [
    { name: "River Sample", email: "hello@example.org", relationship: "client", relationshipCloseness: "greetme_worthy", recipientType: "client", company: "Riverstone Bakery" },
  ],
  vendor: [
    { name: "Ames Sample", email: "print@example.com", relationship: "vendor", relationshipCloseness: "greetme_worthy", recipientType: "vendor", company: "Acme Print Co" },
  ],
};

let BUNDLE = "";
test.beforeAll(async () => {
  const entry = `import React from "react"; import { createRoot } from "react-dom/client";
    import PracticeView from "${join(__dirname, "..", "src", "components", "RecipientsPracticeView.jsx").replace(/\\/g, "/")}";
    window.__mount = (el, props) => createRoot(el).render(React.createElement(PracticeView, { onExit: () => {}, onReturnToWizard: () => {}, ...props }));`;
  const out = await esbuild.build({ stdin: { contents: entry, resolveDir: __dirname, loader: "js" }, write: false, bundle: true, format: "iife", platform: "browser", jsx: "automatic", jsxImportSource: "react", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  BUNDLE = out.outputFiles[0].text;
});
const SHELL = (b) => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#f3eef9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}</style></head><body><div id="root"></div><script>${b}</script></body></html>`;
async function render(page, width, props) {
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent(SHELL(BUNDLE));
  await page.evaluate((p) => window.__mount(document.getElementById("root"), p), props);
  await page.waitForSelector('[data-testid="practice-banner"]');
}

for (const kind of ["family", "friend", "professional", "employee", "client", "vendor"]) {
  test(`Practice View — ${kind} (fictional data)`, async ({ page }) => {
    await render(page, 1120, { status: "active", contacts: FIXTURES[kind], isMobile: false });
    await page.screenshot({ path: join(SHOTS, `practice-${kind}-desktop.jpg`), type: "jpeg", quality: 64, fullPage: true });
    await expect(page.locator("body")).toContainText("Test Drive — Practice Contacts");
    expect(await page.locator('[data-testid="practice-card"]').count()).toBe(FIXTURES[kind].length);
  });
}
test("Practice View — Family mobile + Employee narrow", async ({ page }) => {
  await render(page, 390, { status: "active", contacts: FIXTURES.family, isMobile: true });
  await page.screenshot({ path: join(SHOTS, "practice-family-mobile.jpg"), type: "jpeg", quality: 64, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.setContent(SHELL(BUNDLE).replace('<div id="root">', '<div id="root" style="width:380px;margin:0 auto">'));
  await page.evaluate((p) => window.__mount(document.getElementById("root"), p), { status: "active", contacts: FIXTURES.employee, isMobile: false });
  await page.waitForSelector('[data-testid="practice-banner"]');
  await page.screenshot({ path: join(SHOTS, "practice-employee-narrow.jpg"), type: "jpeg", quality: 64, fullPage: true });
});
test("Practice View — empty state + exit confirmation + detail", async ({ page }) => {
  await render(page, 900, { status: "empty", contacts: [], isMobile: false });
  await page.screenshot({ path: join(SHOTS, "practice-empty.jpg"), type: "jpeg", quality: 66 });
  await expect(page.locator("body")).toContainText("No practice contacts are currently loaded.");
  await render(page, 900, { status: "active", contacts: FIXTURES.employee, isMobile: false });
  await page.click('[data-testid="practice-exit"]');
  await page.waitForSelector('[data-testid="practice-exit-confirm"]');
  await page.screenshot({ path: join(SHOTS, "practice-exit-confirm.jpg"), type: "jpeg", quality: 66 });
  await expect(page.locator("body")).toContainText("Exit Test Drive?");
  await page.click('[data-testid="practice-exit-confirm-no"]');
  await page.click('[data-testid="practice-view-details"]');
  await page.waitForSelector('[data-testid="practice-detail"]');
  await page.screenshot({ path: join(SHOTS, "practice-detail.jpg"), type: "jpeg", quality: 66 });
  await expect(page.locator("body")).toContainText("fictional data, not saved to your account");
});
