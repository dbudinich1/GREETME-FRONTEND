// Team 1D fixture-only Playwright config. No webServer: the preview is started by hand on 5234
// (proposed) and compared against the baseline preview via BASE_URL. All /api traffic is
// intercepted by the spec; nothing reaches a backend.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /closeout1d\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 45000,
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:5234', viewport: { width: 1440, height: 900 } },
});
