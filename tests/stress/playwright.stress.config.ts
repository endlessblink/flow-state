import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Stress Test Configuration
 * TASK-338: Comprehensive stress testing
 *
 * Specialized config for stress/load testing scenarios
 * that require longer timeouts and specific test patterns.
 */
export default defineConfig({
  testDir: './',
  fullyParallel: false, // Sequential for stress tests to avoid resource contention
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for stress tests - we want to see actual failures
  workers: 1, // Single worker for consistent stress measurement
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../reports/stress-test-report' }]
  ],

  // Longer timeouts for stress scenarios
  timeout: 120_000, // 2 minutes per test
  expect: {
    timeout: 30_000
  },

  use: {
    baseURL: 'http://localhost:5546',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Slower actions for stress tests to capture timing issues
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'stress-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start dev server - assume it's already running
  webServer: {
    command: 'echo "Dev server should be running on port 5546"',
    url: 'http://localhost:5546',
    reuseExistingServer: true,
    timeout: 5_000,
  },
});
