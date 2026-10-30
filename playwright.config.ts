import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', workers: 1, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'npm run build -- --outDir dist-test --base /D-D/ && npm run preview -- --outDir dist-test --base /D-D/ --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/D-D/',
    reuseExistingServer: false,
    env: { FIREBASE_WEB_API_KEY: 'browser-test-placeholder' },
  },
});
