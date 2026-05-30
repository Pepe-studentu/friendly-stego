import { defineConfig, devices } from '@playwright/test';

// One lean happy-path e2e. Playwright boots both the API server and the Vue
// dev server; the client proxies /api to the server, so the test only ever
// drives the real UI at the client origin.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'], // mobile-first: drive it as a phone (Chromium-based)
  },
  webServer: [
    {
      command: 'npm --prefix server start',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm --prefix client run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
