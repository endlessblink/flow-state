import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const authFile = 'tests/.auth/user.json';
const hasAuth = fs.existsSync(authFile);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // TASK-1457: Global setup resets test data and authenticates dev user
  globalSetup: './tests/global-setup.ts',
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:5546',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // TASK-1457: Use saved auth state if available (from global-setup)
        ...(hasAuth ? { storageState: authFile } : {}),
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Keep Playwright server startup minimal and deterministic.
    // `npm run dev` includes extra watchers and secret sync that can delay readiness.
    command: 'npx vite --host 127.0.0.1 --port 5546 --strictPort',
    url: 'http://127.0.0.1:5546',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
