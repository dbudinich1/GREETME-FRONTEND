import { defineConfig, devices } from '@playwright/test';

const PORT = 5253;

export default defineConfig({
  testDir: './tests',
  testMatch: 'sendGreetingSurface3.spec.js',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 120000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});

