import { defineConfig, devices } from '@playwright/test';

const PORT = 5221;

export default defineConfig({
  testDir: './tests',
  testMatch: 'sendLimitSurface1Review.spec.js',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
