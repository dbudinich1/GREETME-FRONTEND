/**
 * playwright.config.js
 * Viewport Fit Gate - Pre-deploy validation
 *
 * Tests greeting card layout at 3 canonical viewports:
 * - Desktop: 1440x900
 * - Mobile Portrait: 390x844
 * - Mobile Landscape: 844x390
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 30000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'Desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Mobile Portrait',
      use: {
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Landscape',
      use: {
        viewport: { width: 844, height: 390 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // Local dev server for testing
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
