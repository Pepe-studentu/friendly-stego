import { defineConfig, devices } from '@playwright/test';

// One lean happy-path e2e. The app is static, so Playwright only needs to boot
// the Vue dev server and drive the real UI (steganography runs in the browser).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'], // mobile-first: drive it as a phone (Chromium-based)
  },
  webServer: {
    command: 'npm --prefix client run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
