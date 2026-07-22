import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 900 }, screenshot: 'off' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
