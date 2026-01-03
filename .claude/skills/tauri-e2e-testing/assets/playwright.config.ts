/**
 * Playwright Configuration for Tauri v2 Applications
 *
 * Copy this file to your project root.
 * Adjust the webServer.command and port as needed.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // Test directory
  testDir: path.join(__dirname, 'src/tests/e2e'),

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers in CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Tauri dev server configuration
  webServer: {
    command: 'npm run tauri dev',
    url: 'http://localhost:1430', // Tauri dev server default port
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for Rust compilation
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:1430',

    // Capture trace on first retry
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Test timeout
  timeout: 30 * 1000,

  // Assertion timeout
  expect: {
    timeout: 5 * 1000,
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Global setup (optional)
  // globalSetup: require.resolve('./src/tests/e2e/global-setup.ts'),

  // Global teardown (optional)
  // globalTeardown: require.resolve('./src/tests/e2e/global-teardown.ts'),
});
