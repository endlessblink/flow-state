/**
 * Playwright Configuration for User Flow Testing
 * Optimized for Pomo-Flow Vue.js application testing
 */

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: path.resolve(__dirname, '../../../../tests/user-flows'),

  // Global settings
  timeout: 60000,
  expect: {
    timeout: 10000
  },

  // Retry failed tests
  retries: 2,

  // Reporter configuration
  reporter: [
    ['html', {
      outputFolder: path.resolve(__dirname, '../../docs/reports/user-flow-playwright-report'),
      open: 'never' // Don't auto-open report
    }],
    ['json', {
      outputFile: path.resolve(__dirname, '../../docs/reports/user-flow-playwright-results.json')
    }],
    ['junit', {
      outputFile: path.resolve(__dirname, '../../docs/reports/user-flow-junit-results.xml')
    }],
    ['list'] // Console output
  ],

  // Global setup and teardown - DISABLED for debugging
  // globalSetup: path.resolve(__dirname, './global-setup.cjs'),
  // globalTeardown: path.resolve(__dirname, './global-teardown.cjs'),

  // Test artifacts
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:5546',

    // Screenshots and videos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Browser settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Network settings
    bypassCSP: true,

    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // User agent
    userAgent: 'PomoFlow-UserFlow-Testing/1.0.0',

    // Colors and media
    colorScheme: 'dark',
    reducedMotion: 'reduce',

    // Performance monitoring
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000
  },

  // Projects for different browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.spec.js'
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/*.spec.js'
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/*.spec.js'
    },

    // Mobile devices
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      },
      testMatch: '**/mobile-*.spec.js'
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
      testMatch: '**/mobile-*.spec.js'
    },

    // Tablet devices
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
      testMatch: '**/tablet-*.spec.js'
    }
  ],

  // Test organization
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ],

  // Output directory for test artifacts
  outputDir: path.resolve(__dirname, '../../docs/reports/test-artifacts'),

  // Web server (if needed) - DISABLED for existing server
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5546',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  //   stdout: 'ignore',
  //   stderr: 'pipe'
  // },

  // Dependencies
  fullyParallel: true,

  // Workers configuration
  workers: process.env.CI ? 2 : 4,

  // Global test configuration
  grep: process.env.GREP,
  grepInvert: process.env.GREP_INVERT,

  // Environment variables
  env: {
    NODE_ENV: 'test',
    PWDEBUG: process.env.PWDEBUG
  }
});