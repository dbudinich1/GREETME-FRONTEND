/**
 * playwright.config.js
 * Viewport Fit Gate - Pre-deploy validation
 *
 * Tests greeting card layout at 3 viewports:
 * - Desktop: 1920x1080
 * - Mobile Portrait: 375x667
 * - Mobile Landscape: 667x375
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
        viewport: { width: 1920, height: 1080 },
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Mobile Portrait',
      use: {
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Landscape',
      use: {
        viewport: { width: 667, height: 375 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
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
