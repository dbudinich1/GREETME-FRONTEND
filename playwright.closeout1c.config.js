// Team 1C fixture-only Playwright config. No webServer: the proposed preview is started by hand on
// 5233 (VITE_FUNDRAISER_ENABLED=true) from this worktree; BASE_URL points the "current" renders at a
// baseline preview. All /api traffic is intercepted by the spec; nothing reaches a backend.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /closeout1c\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:5233', viewport: { width: 1440, height: 900 } },
});
