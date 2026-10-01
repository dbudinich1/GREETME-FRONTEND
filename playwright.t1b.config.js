// playwright.t1b.config.js â€” Closeout T1B fixture run (own dev server on port 5232; never reuses another).
import { defineConfig, devices } from '@playwright/test';

const PORT = 5232;

export default defineConfig({
  testDir: './tests',
  testMatch: ['t1bCommerceFixtures.spec.js', 't1bMerchGuard.spec.js'],
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 150000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'Desktop', use: { viewport: { width: 1440, height: 900 }, ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300000,
  },
});
