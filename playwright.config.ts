import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /*
  webServer: {
    command: 'node dist/server.mjs',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      PORT: '3100',
      NODE_ENV: 'test',
    },
  },
  */
});
