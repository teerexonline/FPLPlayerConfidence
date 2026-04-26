import { defineConfig, devices } from '@playwright/test';

// Isolate E2E runs to a separate SQLite file so they never touch the
// production database. Must be set before globalSetup runs.
process.env['DB_PATH'] = 'data/fpl.test.db';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup/seed-db.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      DB_PATH: 'data/fpl.test.db',
    },
  },
});
