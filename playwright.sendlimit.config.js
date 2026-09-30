// playwright.sendlimit.config.js — SEND-LIMIT RECOVERY CORRECTION (2026-09-30) screenshot run.
//
// Uses its own dev server on a dedicated port so it never touches (or reuses) a dev server another
// worktree/session may already have running on the shared default port 5173.
import { defineConfig, devices } from '@playwright/test';

const PORT = 5219;

export default defineConfig({
  testDir: './tests',
  testMatch: 'sendLimitRecoveryScreenshots.spec.js',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30000,

  use: {
    baseURL: `http://localhost:${PORT}`,
  },

  projects: [
    {
      name: 'Desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
