// playwright.layout.config.mjs — ISOLATED config for the Screen-2 layout geometry test.
// Deliberately separate from the repo's playwright.config.js (whose specs target production hosts):
// this config has NO webServer and NO baseURL, and the spec renders via page.setContent(), so it
// never issues a network request or touches production. Run:
//   npx playwright test --config=playwright.layout.config.mjs
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./layout-tests",
  testMatch: /.*\.spec\.mjs/,
  timeout: 30000,
  fullyParallel: false,
  reporter: "list",
  use: { headless: true, offline: true, baseURL: undefined },   // offline: guarantees no network egress
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
